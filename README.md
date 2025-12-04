# DecentralizedSolarMicrogridTrading

A privacy-first decentralized energy trading platform for neighborhood solar microgrids, enabling participants to anonymously trade surplus solar energy without revealing personal consumption patterns. Encrypted energy generation and consumption data are reported to the blockchain, while FHE-based P2P price matching and automated on-chain settlements ensure secure and confidential transactions.

## Project Background

Traditional energy trading systems face challenges of privacy, transparency, and trust:

• Privacy concerns: Consumers hesitate to share consumption patterns due to confidentiality risks

• Centralized intermediaries: Operators can manipulate prices or transaction records

• Lack of transparency: Users cannot verify if trades are settled correctly

• Limited analytics: Aggregated energy and transaction data may be unreliable

This platform addresses these challenges with blockchain and FHE technology:

• All energy transactions are submitted through smart contracts and stored immutably

• Transaction data is encrypted before submission — even platform operators cannot see raw details

• P2P price matching and energy accounting are performed securely while preserving privacy

• On-chain settlement is transparent, automated, and verifiable

## Features

### Core Functionality

• Energy Transaction Submission: Users submit encrypted seller ID, buyer ID, energy amount, and price

• P2P Price Matching: Automatic matching of supply and demand based on encrypted offers

• Transaction Listing: Users can view submitted transactions without revealing sensitive details

• Anonymous Participation: No personal data is required for trading

• Real-time Dashboard: Monitor energy trades, participants, and statistics instantly

### Privacy & Security

• Client-side Encryption: All transaction data is encrypted before leaving the device

• Fully Anonymous: No wallet or identity linkage required for submission

• Immutable Records: Transactions cannot be altered or removed once recorded

• Encrypted Computation: Aggregation and settlement are performed securely on encrypted data

## Architecture

### Smart Contracts

SolarEnergyTradingFHE.sol (deployed on Ethereum)

• Manages encrypted energy transactions (seller, buyer, amount, price)

• Maintains immutable transaction storage on-chain

• Aggregates seller statistics automatically

• Provides transparent access to transaction counts and settlement status

### Frontend Application

• React + TypeScript: Interactive, responsive user interface

• Ethers.js: Blockchain interaction and contract calls

• Modern UI/UX: Dashboard with filtering, search, and statistics

• Wallet Integration: Ethereum wallet support (optional)

• Real-time Updates: Fetches encrypted transactions and statistics directly from blockchain

## Technology Stack

### Blockchain

• Solidity ^0.8.24: Smart contract development

• OpenZeppelin: Secure contract libraries

• Hardhat: Development, testing, and deployment

• Ethereum Sepolia Testnet: Current deployment network

### Frontend

• React 18 + TypeScript: Modern frontend framework

• Ethers.js: Ethereum interaction

• Tailwind + CSS: Styling and responsive layout

• Vercel: Frontend deployment

## Installation

### Prerequisites

• Node.js 18+

• npm / yarn / pnpm package manager

• Ethereum wallet (MetaMask, WalletConnect, etc.)

### Setup

```bash
# Install dependencies
npm install

# Compile smart contracts
npx hardhat compile

# Deploy to network (configure hardhat.config.js first)
npx hardhat run deploy/deploy.ts --network sepolia

# Start frontend
cd frontend
npm install
npm run dev
```

## Usage

• Connect Wallet: Optional for authenticated deployments

• Browse Transactions: View submitted energy trades anonymously

• Monitor Statistics: Check aggregated energy supply and seller counts

• Search & Filter: Find transactions by seller, buyer, or category

## Security Features

• Encrypted Submission: All transaction data encrypted client-side

• Immutable Storage: Transactions cannot be altered once recorded

• Anonymous Participation: No personal data is linked to trades

• Transparent Aggregation: Seller counts and energy totals verifiable on-chain

## Future Enhancements

• Full Homomorphic Encryption (FHE) integration for secure computation on encrypted energy data

• Alerting system for threshold-based energy availability

• Multi-chain deployment for wider accessibility

• Mobile-optimized user interface

• DAO governance for community-driven energy trading improvements

Built with ❤️ for a more secure, private, and transparent neighborhood energy trading environment
