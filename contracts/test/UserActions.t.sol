// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {UserActions} from "../src/UserActions.sol";
import {Vm} from "forge-std/Vm.sol";

contract UserActionsTest is Test {
    UserActions userActions;
    address deployer = address(this);
    address user = makeAddr("user");
    address attestationVerifier = makeAddr("verifier");
    address otherAddress = makeAddr("other");

    bytes32 constant ACTION_TYPE_TEMP = keccak256("temp_gt_15_seoul");

    function setUp() public {
        // Deploy UserActions, setting the initial verifier address
        userActions = new UserActions(deployer, attestationVerifier);
    }

    function testDeployment() public {
        assertEq(userActions.owner(), deployer, "Test Fail: Incorrect owner");
        assertEq(userActions.attestationVerifierAddress(), attestationVerifier, "Test Fail: Incorrect verifier address");
    }

    // function testRecordVerifiedAction_success() public {
    //     uint256 initialTimestamp = block.timestamp;
    //     bytes memory proofData = hex"aabbcc";
    //     uint256 expectedActionId = 0;

    //     // Prank as the authorized verifier
    //     vm.startPrank(attestationVerifier);
        
    //     // Expect event
    //     vm.expectEmit(true, true, true, false, address(userActions)); // index user, actionType, timestamp
    //     emit UserActions.ActionRecorded(expectedActionId, user, ACTION_TYPE_TEMP, initialTimestamp);
        
    //     userActions.recordVerifiedAction(user, ACTION_TYPE_TEMP, initialTimestamp, proofData);
    //     vm.stopPrank();

    //     // Verify record details
    //     UserActions.ActionRecord memory record = userActions.actionRecords(expectedActionId);
    //     assertEq(record.user, user, "Record user mismatch");
    //     assertEq(record.actionType, ACTION_TYPE_TEMP, "Record action type mismatch");
    //     assertEq(record.timestamp, initialTimestamp, "Record timestamp mismatch");
    //     assertEq(record.proofData, proofData, "Record proof data mismatch");

    //     // Verify last action timestamp
    //     assertEq(userActions.lastActionTimestamp(user, ACTION_TYPE_TEMP), initialTimestamp, "Last timestamp mismatch");
    // }

    function testFail_RecordVerifiedAction_unauthorized() public {
        uint256 timestamp = block.timestamp;
        bytes memory proofData = hex"aabbcc";

        // Prank as an unauthorized address
        vm.startPrank(otherAddress);
        vm.expectRevert(UserActions.UserActions__UnauthorizedRecorder.selector);
        userActions.recordVerifiedAction(user, ACTION_TYPE_TEMP, timestamp, proofData);
        vm.stopPrank();
    }

    function testFail_RecordVerifiedAction_replay() public {
        uint256 timestamp1 = block.timestamp;
        bytes memory proofData = hex"aabbcc";

        // Record first action
        vm.startPrank(attestationVerifier);
        userActions.recordVerifiedAction(user, ACTION_TYPE_TEMP, timestamp1, proofData);
        vm.stopPrank();

        // Advance time slightly (less than 1 hour)
        vm.warp(timestamp1 + 30 minutes);
        uint256 timestamp2 = block.timestamp;

        // Try recording the same action again too soon
        vm.startPrank(attestationVerifier);
        vm.expectRevert(UserActions.UserActions__ActionAlreadyRecordedRecently.selector);
        userActions.recordVerifiedAction(user, ACTION_TYPE_TEMP, timestamp2, proofData);
        vm.stopPrank();
    }
    
    function testRecordVerifiedAction_success_afterDelay() public {
        uint256 timestamp1 = block.timestamp;
        bytes memory proofData = hex"aabbcc";

        // Record first action
        vm.startPrank(attestationVerifier);
        userActions.recordVerifiedAction(user, ACTION_TYPE_TEMP, timestamp1, proofData);
        vm.stopPrank();

        // Advance time (more than 1 hour)
        vm.warp(timestamp1 + 2 hours);
        uint256 timestamp2 = block.timestamp;
        uint256 expectedActionId = 1;

        // Record second action (should succeed)
        vm.startPrank(attestationVerifier);
        vm.expectEmit(true, true, true, false, address(userActions)); 
        emit UserActions.ActionRecorded(expectedActionId, user, ACTION_TYPE_TEMP, timestamp2);
        userActions.recordVerifiedAction(user, ACTION_TYPE_TEMP, timestamp2, proofData);
        vm.stopPrank();
        
        assertEq(userActions.lastActionTimestamp(user, ACTION_TYPE_TEMP), timestamp2, "Second timestamp mismatch");
    }

    function testSetAttestationVerifier() public {
        address newVerifier = makeAddr("newVerifier");
        vm.prank(deployer);
        vm.expectEmit(true, false, false, false, address(userActions)); // index newVerifierAddress
        emit UserActions.AttestationVerifierSet(newVerifier);
        userActions.setAttestationVerifier(newVerifier);
        assertEq(userActions.attestationVerifierAddress(), newVerifier, "Failed to set new verifier");
    }
    
    function testFail_SetAttestationVerifier_notOwner() public {
        address newVerifier = makeAddr("newVerifier");
        vm.prank(otherAddress);
        vm.expectRevert("Ownable: caller is not the owner");
        userActions.setAttestationVerifier(newVerifier);
        vm.stopPrank();
    }
} 