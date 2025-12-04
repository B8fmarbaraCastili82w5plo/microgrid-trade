// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { FHE, euint32, ebool } from "@fhevm/solidity/lib/FHE.sol";
import { SepoliaConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

contract SolarEnergyTradingFHE is SepoliaConfig {
    struct EncryptedTransaction {
        uint256 id;
        euint32 encryptedSellerId;
        euint32 encryptedBuyerId;
        euint32 encryptedEnergyAmount;
        euint32 encryptedPrice;
        uint256 timestamp;
    }

    struct DecryptedTransaction {
        string sellerId;
        string buyerId;
        string energyAmount;
        string price;
        bool isSettled;
    }

    uint256 public transactionCount;
    mapping(uint256 => EncryptedTransaction) public encryptedTransactions;
    mapping(uint256 => DecryptedTransaction) public decryptedTransactions;

    mapping(string => euint32) private encryptedEnergyBySeller;
    string[] private sellerList;

    mapping(uint256 => uint256) private requestToTransactionId;

    event TransactionSubmitted(uint256 indexed id, uint256 timestamp);
    event DecryptionRequested(uint256 indexed id);
    event TransactionDecrypted(uint256 indexed id);

    modifier onlyParticipant(uint256 transactionId) {
        _; // Placeholder for access control
    }

    /// @notice Submit encrypted energy transaction
    function submitEncryptedTransaction(
        euint32 encryptedSellerId,
        euint32 encryptedBuyerId,
        euint32 encryptedEnergyAmount,
        euint32 encryptedPrice
    ) public {
        transactionCount += 1;
        uint256 newId = transactionCount;

        encryptedTransactions[newId] = EncryptedTransaction({
            id: newId,
            encryptedSellerId: encryptedSellerId,
            encryptedBuyerId: encryptedBuyerId,
            encryptedEnergyAmount: encryptedEnergyAmount,
            encryptedPrice: encryptedPrice,
            timestamp: block.timestamp
        });

        decryptedTransactions[newId] = DecryptedTransaction({
            sellerId: "",
            buyerId: "",
            energyAmount: "",
            price: "",
            isSettled: false
        });

        emit TransactionSubmitted(newId, block.timestamp);
    }

    /// @notice Request decryption of a transaction
    function requestTransactionDecryption(uint256 transactionId) public onlyParticipant(transactionId) {
        EncryptedTransaction storage txn = encryptedTransactions[transactionId];
        require(!decryptedTransactions[transactionId].isSettled, "Already settled");

        bytes32 ;
        ciphertexts[0] = FHE.toBytes32(txn.encryptedSellerId);
        ciphertexts[1] = FHE.toBytes32(txn.encryptedBuyerId);
        ciphertexts[2] = FHE.toBytes32(txn.encryptedEnergyAmount);
        ciphertexts[3] = FHE.toBytes32(txn.encryptedPrice);

        uint256 reqId = FHE.requestDecryption(ciphertexts, this.decryptTransaction.selector);
        requestToTransactionId[reqId] = transactionId;

        emit DecryptionRequested(transactionId);
    }

    /// @notice Callback after decryption
    function decryptTransaction(
        uint256 requestId,
        bytes memory cleartexts,
        bytes memory proof
    ) public {
        uint256 transactionId = requestToTransactionId[requestId];
        require(transactionId != 0, "Invalid request");

        EncryptedTransaction storage eTxn = encryptedTransactions[transactionId];
        DecryptedTransaction storage dTxn = decryptedTransactions[transactionId];
        require(!dTxn.isSettled, "Already settled");

        FHE.checkSignatures(requestId, cleartexts, proof);

        string[] memory results = abi.decode(cleartexts, (string[]));

        dTxn.sellerId = results[0];
        dTxn.buyerId = results[1];
        dTxn.energyAmount = results[2];
        dTxn.price = results[3];
        dTxn.isSettled = true;

        if (FHE.isInitialized(encryptedEnergyBySeller[dTxn.sellerId]) == false) {
            encryptedEnergyBySeller[dTxn.sellerId] = FHE.asEuint32(0);
            sellerList.push(dTxn.sellerId);
        }

        encryptedEnergyBySeller[dTxn.sellerId] = FHE.add(
            encryptedEnergyBySeller[dTxn.sellerId],
            FHE.asEuint32(1)
        );

        emit TransactionDecrypted(transactionId);
    }

    /// @notice Get decrypted transaction
    function getDecryptedTransaction(uint256 transactionId) public view returns (
        string memory sellerId,
        string memory buyerId,
        string memory energyAmount,
        string memory price,
        bool isSettled
    ) {
        DecryptedTransaction storage txn = decryptedTransactions[transactionId];
        return (txn.sellerId, txn.buyerId, txn.energyAmount, txn.price, txn.isSettled);
    }

    /// @notice Get encrypted energy total by seller
    function getEncryptedEnergyBySeller(string memory seller) public view returns (euint32) {
        return encryptedEnergyBySeller[seller];
    }
}
