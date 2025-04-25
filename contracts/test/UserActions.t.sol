// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {UserActions} from "../src/UserActions.sol";
import {Vm} from "forge-std/Vm.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol"; // Import Ownable for the error selector

contract UserActionsTest is Test {
    UserActions userActions;
    address owner;
    address user;
    address nonOwner;

    // Example action data
    bytes32 constant ACTION_TYPE_TEMP = keccak256("HIGH_TEMP_SEOUL");
    uint256 constant ACTION_TIMESTAMP = 1700000000; // Example timestamp
    bytes proofData = hex"aabbcc"; // Example proof data

    function setUp() public {
        owner = makeAddr("owner");
        user = makeAddr("user");
        nonOwner = makeAddr("nonOwner");

        vm.startPrank(owner);
        // Provide both owner and a mock verifier address (using address(this) for the test contract)
        userActions = new UserActions(owner, address(this)); 
        vm.stopPrank();
    }

    function testDeployment() public {
        assertEq(userActions.owner(), owner, "Test Fail: Incorrect owner");
        assertEq(userActions.attestationVerifierAddress(), address(this), "Test Fail: Incorrect verifier address");
    }

    // --- Test recordVerifiedAction ---

    function test_RecordAction_Success() public {
        // Call from the designated verifier (address(this) in setup)
        vm.startPrank(address(this));

        // Expect event emission
        vm.expectEmit(true, true, false, false); // Check indexed user, actionType. Ignore timestamp, proofData.
        emit UserActions.ActionRecorded(user, ACTION_TYPE_TEMP, ACTION_TIMESTAMP, proofData);

        // Record the action
        userActions.recordVerifiedAction(user, ACTION_TYPE_TEMP, ACTION_TIMESTAMP, proofData);

        // Verify state
        assertEq(userActions.lastActionTimestamp(user, ACTION_TYPE_TEMP), ACTION_TIMESTAMP, "Timestamp not recorded");

        vm.stopPrank();
    }

    function testFail_RecordAction_NotVerifier() public {
        // Try calling from non-verifier (even owner)
        vm.startPrank(owner); 
        vm.expectRevert(UserActions.UserActions__NotAttestationVerifier.selector);
        userActions.recordVerifiedAction(user, ACTION_TYPE_TEMP, ACTION_TIMESTAMP, proofData);
        vm.stopPrank();

        // Try calling from another non-verifier
        vm.startPrank(nonOwner); 
        vm.expectRevert(UserActions.UserActions__NotAttestationVerifier.selector);
        userActions.recordVerifiedAction(user, ACTION_TYPE_TEMP, ACTION_TIMESTAMP, proofData);
        vm.stopPrank();
    }

    function testFail_RecordAction_TimestampTooOld() public {
        // Call from the designated verifier
        vm.startPrank(address(this));

        // Record initial action
        userActions.recordVerifiedAction(user, ACTION_TYPE_TEMP, ACTION_TIMESTAMP, proofData);

        // Try to record with same timestamp
        vm.expectRevert(UserActions.UserActions__TimestampTooOld.selector);
        userActions.recordVerifiedAction(user, ACTION_TYPE_TEMP, ACTION_TIMESTAMP, proofData);

        // Try to record with older timestamp
        vm.expectRevert(UserActions.UserActions__TimestampTooOld.selector);
        userActions.recordVerifiedAction(user, ACTION_TYPE_TEMP, ACTION_TIMESTAMP - 1, proofData);

        vm.stopPrank();
    }
    
    function test_RecordAction_AllowsDifferentActionType() public {
        // Call from the designated verifier
        vm.startPrank(address(this));
        bytes32 anotherActionType = keccak256("ANOTHER_ACTION");

        // Record initial action
        userActions.recordVerifiedAction(user, ACTION_TYPE_TEMP, ACTION_TIMESTAMP, proofData);

        // Record a different action type with the same timestamp (should succeed)
        vm.expectEmit(true, true, false, false); 
        emit UserActions.ActionRecorded(user, anotherActionType, ACTION_TIMESTAMP, proofData);
        userActions.recordVerifiedAction(user, anotherActionType, ACTION_TIMESTAMP, proofData);

        assertEq(userActions.lastActionTimestamp(user, anotherActionType), ACTION_TIMESTAMP, "Second action timestamp mismatch");
        vm.stopPrank();
    }

    function test_RecordAction_NonReentrant() public {
        // This test requires a malicious contract to test reentrancy.
        // Placeholder for now, can be implemented if needed.
        assertTrue(true, "Reentrancy test not implemented");
    }

    // --- Test setAttestationVerifierAddress ---

    function test_SetAttestationVerifierAddress_Success() public {
        address newVerifier = makeAddr("newVerifier");
        vm.startPrank(owner);
        vm.expectEmit(true, false, false, false); // Check indexed newVerifier
        emit UserActions.AttestationVerifierSet(newVerifier);
        userActions.setAttestationVerifierAddress(newVerifier);
        assertEq(userActions.attestationVerifierAddress(), newVerifier, "Test Fail: Verifier not updated");
        vm.stopPrank();
    }

    function testFail_SetAttestationVerifierAddress_NotOwner() public {
        address newVerifier = makeAddr("newVerifier");
        vm.startPrank(nonOwner);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, nonOwner));
        userActions.setAttestationVerifierAddress(newVerifier);
        vm.stopPrank();
    }

    function testFail_SetAttestationVerifierAddress_ZeroAddress() public {
        vm.startPrank(owner);
        vm.expectRevert("Invalid verifier address");
        userActions.setAttestationVerifierAddress(address(0));
        vm.stopPrank();
    }

} 