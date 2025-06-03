// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import { IEscrow } from "./interfaces/IEscrow.sol";
import { IEscrowViewer } from "./interfaces/IEscrowViewer.sol";

contract EscrowViewer is IEscrowViewer {
    IEscrow public immutable escrowContract;

    constructor(address _escrow) {
        require(_escrow != address(0), "EscrowViewer: Invalid Escrow contract address");
        escrowContract = IEscrow(_escrow);
    }

    /**
     * @notice Gets details for a single deposit.
     * @param _depositId The ID of the deposit.
     * @return depositView The DepositView struct.
     */
    function getDeposit(uint256 _depositId) public view returns (IEscrowViewer.DepositView memory depositView) {
        IEscrow.Deposit memory deposit = escrowContract.getDeposit(_depositId);
        ( , uint256 reclaimableAmount) = escrowContract.getPrunableIntents(_depositId);

        VerifierDataView[] memory verifiers = new VerifierDataView[](escrowContract.getDepositVerifiers(_depositId).length);
        for (uint256 i = 0; i < verifiers.length; ++i) {
            address verifier = escrowContract.getDepositVerifiers(_depositId)[i];
            IEscrow.Currency[] memory currencies = new IEscrow.Currency[](escrowContract.getDepositCurrencies(_depositId, verifier).length);
            for (uint256 j = 0; j < currencies.length; ++j) {
                bytes32 code = escrowContract.getDepositCurrencies(_depositId, verifier)[j];
                currencies[j] = IEscrow.Currency({
                    code: code,
                    conversionRate: escrowContract.getDepositCurrencyConversionRate(_depositId, verifier, code)
                });
            }
            verifiers[i] = VerifierDataView({
                verifier: verifier,
                verificationData: escrowContract.getDepositVerifierData(_depositId, verifier),
                currencies: currencies
            });
        }

        depositView = DepositView({
            depositId: _depositId,
            deposit: deposit,
            availableLiquidity: deposit.remainingDeposits + reclaimableAmount,
            verifiers: verifiers
        });
    }

    /**
     * @notice Gets deposit details for a list of deposit IDs.
     * @param _depositIds Array of deposit IDs.
     * @return depositArray Array of DepositView structs.
     */
    function getDepositFromIds(
        uint256[] memory _depositIds
    ) external view override returns (IEscrowViewer.DepositView[] memory depositArray) {
        depositArray = new DepositView[](_depositIds.length);

        for (uint256 i = 0; i < _depositIds.length; ++i) {
            uint256 depositId = _depositIds[i];
            depositArray[i] = getDeposit(depositId);
        }
    }

    /**
     * @notice Gets all deposits for a specific account.
     * @param _account The account address.
     * @return depositArray Array of DepositView structs.
     */
    function getAccountDeposits(address _account) external view returns (IEscrowViewer.DepositView[] memory depositArray) {
        uint256[] memory accountDepositIds = escrowContract.getAccountDeposits(_account);
        depositArray = new DepositView[](accountDepositIds.length);
        
        for (uint256 i = 0; i < accountDepositIds.length; ++i) {
            uint256 depositId = accountDepositIds[i];
            depositArray[i] = getDeposit(depositId);
        }
    }

    /**
     * @notice Gets details for a single intent.
     * @param _intentHash The hash of the intent.
     * @return intentView The IntentView struct.
     */
    function getIntent(bytes32 _intentHash) public view returns (IEscrowViewer.IntentView memory intentView) {
        IEscrow.Intent memory intent = escrowContract.getIntent(_intentHash);
        DepositView memory deposit = getDeposit(intent.depositId);
        intentView = IntentView({
            intentHash: _intentHash,
            intent: intent,
            deposit: deposit
        });
    }

    /**
     * @notice Gets details for a list of intent hashes.
     * @param _intentHashes Array of intent hashes.
     * @return intentArray Array of IntentView structs.
     */
    function getIntents(bytes32[] calldata _intentHashes) external view returns (IEscrowViewer.IntentView[] memory intentArray) {
        intentArray = new IntentView[](_intentHashes.length);

        for (uint256 i = 0; i < _intentHashes.length; ++i) {
            intentArray[i] = getIntent(_intentHashes[i]);
        }
    }

    /**
     * @notice Gets the active intent for a specific account.
     * @param _account The account address.
     * @return intentView The IntentView struct.
     */
    function getAccountIntent(address _account) external view returns (IEscrowViewer.IntentView memory intentView) {
        bytes32 intentHash = escrowContract.getAccountIntent(_account);
        intentView = getIntent(intentHash);
    }
}
