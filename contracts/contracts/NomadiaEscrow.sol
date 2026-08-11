// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @notice V0 non-custodial escrow for Nomadia P2P fiat<->crypto trades.
/// The depositor (the crypto seller) locks `token` for a named counterparty
/// (the crypto buyer, who hands over cash IRL). Funds release to the
/// counterparty once BOTH sides confirm the exchange happened.
///
/// Security model (redesigned after the launch-plan code review, 23 Jul 2026):
///   * Once the counterparty confirms (i.e. they have delivered their cash),
///     the depositor can NO LONGER pull a timeout `refund()` or `cancel()`.
///     This closes the half-confirm scam where a depositor took the cash IRL,
///     never confirmed, waited for the timeout and refunded the crypto too.
///   * A timeout `refund()` is only reachable while the counterparty has NOT
///     confirmed (a genuine no-show), which also removes the confirm/refund
///     front-running race entirely.
///   * Either party can `raiseDispute()` while an offer is Open; a designated
///     `arbiter` then resolves it in one direction. This is the honest answer
///     to the stuck-funds case (counterparty paid, depositor won't confirm)
///     and matches the "manually supervised closed beta" launch model.
///   * `createOffer` accepts only allowlisted tokens and rejects any token
///     that does not deliver the exact `amount` (fee-on-transfer guard).
/// Nomadia (the owner) can manage the allowlist and the arbiter, but holds no
/// key that can move an individual offer's funds outside of dispute resolution.
contract NomadiaEscrow is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    enum Status {
        None,
        Open,
        Released,
        Refunded,
        Disputed
    }

    struct Offer {
        address depositor;
        address counterparty;
        address token;
        uint256 amount;
        uint64 createdAt;
        bool depositorConfirmed;
        bool counterpartyConfirmed;
        Status status;
    }

    uint256 public immutable timeoutSeconds;
    uint256 public nextOfferId = 1;

    /// @notice Address allowed to resolve disputed offers. May be address(0) to
    /// run in pure-trustless mode (disputes disabled, funds can only move via
    /// mutual confirm or a no-show refund).
    address public arbiter;

    mapping(uint256 => Offer) public offers;
    mapping(address => bool) public allowedToken;

    event OfferCreated(
        uint256 indexed offerId,
        address indexed depositor,
        address indexed counterparty,
        address token,
        uint256 amount
    );
    event OfferConfirmed(uint256 indexed offerId, address indexed confirmer);
    event OfferReleased(uint256 indexed offerId, address indexed to, uint256 amount);
    event OfferRefunded(uint256 indexed offerId, address indexed to, uint256 amount);
    event OfferDisputed(uint256 indexed offerId, address indexed by);
    event DisputeResolved(uint256 indexed offerId, bool releasedToCounterparty);
    event TokenAllowlistUpdated(address indexed token, bool allowed);
    event ArbiterUpdated(address indexed arbiter);

    error ZeroAmount();
    error InvalidCounterparty();
    error OfferNotOpen();
    error NotParticipant();
    error AlreadyConfirmed();
    error TimeoutNotReached();
    error TokenNotAllowed();
    error UnexpectedTokenBalance();
    error CounterpartyAlreadyConfirmed();
    error DisputesDisabled();
    error NotArbiter();
    error OfferNotDisputed();

    constructor(uint256 _timeoutSeconds, address _arbiter) Ownable(msg.sender) {
        timeoutSeconds = _timeoutSeconds;
        arbiter = _arbiter;
        emit ArbiterUpdated(_arbiter);
    }

    // --- admin (owner) ---------------------------------------------------

    /// @notice Add or remove a token from the createOffer allowlist. On beta
    /// this is set to the single real Base USDC address only.
    function setTokenAllowed(address token, bool allowed) external onlyOwner {
        allowedToken[token] = allowed;
        emit TokenAllowlistUpdated(token, allowed);
    }

    /// @notice Update the dispute arbiter. Set to address(0) to disable disputes.
    function setArbiter(address _arbiter) external onlyOwner {
        arbiter = _arbiter;
        emit ArbiterUpdated(_arbiter);
    }

    // --- offer lifecycle -------------------------------------------------

    /// @notice Lock `amount` of `token` (caller must have approved this contract first).
    function createOffer(
        address token,
        uint256 amount,
        address counterparty
    ) external nonReentrant returns (uint256 offerId) {
        if (amount == 0) revert ZeroAmount();
        if (counterparty == address(0) || counterparty == msg.sender) {
            revert InvalidCounterparty();
        }
        if (!allowedToken[token]) revert TokenNotAllowed();

        // Fee-on-transfer / rebasing guard: the contract must receive exactly
        // `amount`, otherwise the internal accounting would over-promise on release.
        IERC20 erc20 = IERC20(token);
        uint256 balanceBefore = erc20.balanceOf(address(this));
        erc20.safeTransferFrom(msg.sender, address(this), amount);
        if (erc20.balanceOf(address(this)) - balanceBefore != amount) {
            revert UnexpectedTokenBalance();
        }

        offerId = nextOfferId++;
        offers[offerId] = Offer({
            depositor: msg.sender,
            counterparty: counterparty,
            token: token,
            amount: amount,
            createdAt: uint64(block.timestamp),
            depositorConfirmed: false,
            counterpartyConfirmed: false,
            status: Status.Open
        });

        emit OfferCreated(offerId, msg.sender, counterparty, token, amount);
    }

    /// @notice Either participant confirms the IRL exchange happened. Releases
    /// automatically once both sides have confirmed.
    function confirm(uint256 offerId) external nonReentrant {
        Offer storage o = offers[offerId];
        if (o.status != Status.Open) revert OfferNotOpen();
        if (msg.sender != o.depositor && msg.sender != o.counterparty) {
            revert NotParticipant();
        }

        if (msg.sender == o.depositor) {
            if (o.depositorConfirmed) revert AlreadyConfirmed();
            o.depositorConfirmed = true;
        } else {
            if (o.counterpartyConfirmed) revert AlreadyConfirmed();
            o.counterpartyConfirmed = true;
        }

        emit OfferConfirmed(offerId, msg.sender);

        if (o.depositorConfirmed && o.counterpartyConfirmed) {
            o.status = Status.Released;
            IERC20(o.token).safeTransfer(o.counterparty, o.amount);
            emit OfferReleased(offerId, o.counterparty, o.amount);
        }
    }

    /// @notice Permissionless refund to the depositor once the timeout has elapsed
    /// without the counterparty confirming (a genuine no-show). Refund is blocked
    /// the moment the counterparty confirms, so a depositor can never take back the
    /// crypto after receiving the cash — the closed half-confirm scam.
    function refund(uint256 offerId) external nonReentrant {
        Offer storage o = offers[offerId];
        if (o.status != Status.Open) revert OfferNotOpen();
        if (o.counterpartyConfirmed) revert CounterpartyAlreadyConfirmed();
        if (block.timestamp < uint256(o.createdAt) + timeoutSeconds) {
            revert TimeoutNotReached();
        }
        _refund(offerId, o);
    }

    /// @notice Depositor pulls out early (wrong address / no-show) BEFORE the
    /// counterparty has confirmed. Safe because the counterparty has not yet
    /// delivered their cash. Once they confirm, cancel is blocked.
    function cancel(uint256 offerId) external nonReentrant {
        Offer storage o = offers[offerId];
        if (o.status != Status.Open) revert OfferNotOpen();
        if (msg.sender != o.depositor) revert NotParticipant();
        if (o.counterpartyConfirmed) revert CounterpartyAlreadyConfirmed();
        _refund(offerId, o);
    }

    /// @notice Either participant flags a dispute (e.g. counterparty confirmed
    /// but depositor refuses to). Freezes the offer until the arbiter resolves it.
    function raiseDispute(uint256 offerId) external {
        Offer storage o = offers[offerId];
        if (o.status != Status.Open) revert OfferNotOpen();
        if (msg.sender != o.depositor && msg.sender != o.counterparty) {
            revert NotParticipant();
        }
        if (arbiter == address(0)) revert DisputesDisabled();

        o.status = Status.Disputed;
        emit OfferDisputed(offerId, msg.sender);
    }

    /// @notice Arbiter resolves a disputed offer in one direction.
    function resolveDispute(uint256 offerId, bool releaseToCounterparty) external nonReentrant {
        if (msg.sender != arbiter) revert NotArbiter();
        Offer storage o = offers[offerId];
        if (o.status != Status.Disputed) revert OfferNotDisputed();

        if (releaseToCounterparty) {
            o.status = Status.Released;
            IERC20(o.token).safeTransfer(o.counterparty, o.amount);
            emit OfferReleased(offerId, o.counterparty, o.amount);
        } else {
            o.status = Status.Refunded;
            IERC20(o.token).safeTransfer(o.depositor, o.amount);
            emit OfferRefunded(offerId, o.depositor, o.amount);
        }
        emit DisputeResolved(offerId, releaseToCounterparty);
    }

    function getOffer(uint256 offerId) external view returns (Offer memory) {
        return offers[offerId];
    }

    // --- internal --------------------------------------------------------

    function _refund(uint256 offerId, Offer storage o) private {
        o.status = Status.Refunded;
        IERC20(o.token).safeTransfer(o.depositor, o.amount);
        emit OfferRefunded(offerId, o.depositor, o.amount);
    }
}
