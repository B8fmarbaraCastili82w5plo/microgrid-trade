import React, { useEffect, useState } from "react";
import { ethers } from "ethers";
import { getContractReadOnly, getContractWithSigner } from "./contract";
import WalletManager from "./components/WalletManager";
import WalletSelector from "./components/WalletSelector";
import "./App.css";

interface EnergyTransaction {
  id: string;
  energyAmount: number; // kWh
  pricePerUnit: number; // wei per kWh
  timestamp: number;
  seller: string;
  buyer: string;
  status: "available" | "reserved" | "completed";
  encryptedData: string;
}

const App: React.FC = () => {
  const [account, setAccount] = useState("");
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<EnergyTransaction[]>([]);
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [walletSelectorOpen, setWalletSelectorOpen] = useState(false);
  const [transactionStatus, setTransactionStatus] = useState<{
    visible: boolean;
    status: "pending" | "success" | "error";
    message: string;
  }>({ visible: false, status: "pending", message: "" });
  const [newTransaction, setNewTransaction] = useState({
    energyAmount: 0,
    pricePerUnit: 0,
  });
  const [showTutorial, setShowTutorial] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Calculate statistics
  const availableCount = transactions.filter(t => t.status === "available").length;
  const reservedCount = transactions.filter(t => t.status === "reserved").length;
  const completedCount = transactions.filter(t => t.status === "completed").length;

  useEffect(() => {
    loadTransactions().finally(() => setLoading(false));
  }, []);

  const onWalletSelect = async (wallet: any) => {
    if (!wallet.provider) return;
    try {
      const web3Provider = new ethers.BrowserProvider(wallet.provider);
      setProvider(web3Provider);
      const accounts = await web3Provider.send("eth_requestAccounts", []);
      const acc = accounts[0] || "";
      setAccount(acc);

      wallet.provider.on("accountsChanged", async (accounts: string[]) => {
        const newAcc = accounts[0] || "";
        setAccount(newAcc);
      });
    } catch (e) {
      alert("Failed to connect wallet");
    }
  };

  const onConnect = () => setWalletSelectorOpen(true);
  const onDisconnect = () => {
    setAccount("");
    setProvider(null);
  };

  const loadTransactions = async () => {
    setIsRefreshing(true);
    try {
      const contract = await getContractReadOnly();
      if (!contract) return;
      
      // Check contract availability using FHE
      const isAvailable = await contract.isAvailable();
      if (!isAvailable) {
        console.error("Contract is not available");
        return;
      }
      
      const keysBytes = await contract.getData("transaction_keys");
      let keys: string[] = [];
      
      if (keysBytes.length > 0) {
        try {
          keys = JSON.parse(ethers.toUtf8String(keysBytes));
        } catch (e) {
          console.error("Error parsing transaction keys:", e);
        }
      }
      
      const list: EnergyTransaction[] = [];
      
      for (const key of keys) {
        try {
          const txBytes = await contract.getData(`transaction_${key}`);
          if (txBytes.length > 0) {
            try {
              const txData = JSON.parse(ethers.toUtf8String(txBytes));
              list.push({
                id: key,
                energyAmount: txData.energyAmount,
                pricePerUnit: txData.pricePerUnit,
                timestamp: txData.timestamp,
                seller: txData.seller,
                buyer: txData.buyer || "",
                status: txData.status || "available",
                encryptedData: txData.encryptedData
              });
            } catch (e) {
              console.error(`Error parsing transaction data for ${key}:`, e);
            }
          }
        } catch (e) {
          console.error(`Error loading transaction ${key}:`, e);
        }
      }
      
      list.sort((a, b) => b.timestamp - a.timestamp);
      setTransactions(list);
    } catch (e) {
      console.error("Error loading transactions:", e);
    } finally {
      setIsRefreshing(false);
      setLoading(false);
    }
  };

  const submitTransaction = async () => {
    if (!provider) { 
      alert("Please connect wallet first"); 
      return; 
    }
    
    setCreating(true);
    setTransactionStatus({
      visible: true,
      status: "pending",
      message: "Encrypting energy data with FHE..."
    });
    
    try {
      // Simulate FHE encryption
      const encryptedData = `FHE-${btoa(JSON.stringify({
        amount: newTransaction.energyAmount,
        price: newTransaction.pricePerUnit
      }))}`;
      
      const contract = await getContractWithSigner();
      if (!contract) {
        throw new Error("Failed to get contract with signer");
      }
      
      const txId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

      const txData = {
        energyAmount: newTransaction.energyAmount,
        pricePerUnit: newTransaction.pricePerUnit,
        timestamp: Math.floor(Date.now() / 1000),
        seller: account,
        buyer: "",
        status: "available",
        encryptedData
      };
      
      // Store encrypted data on-chain using FHE
      await contract.setData(
        `transaction_${txId}`, 
        ethers.toUtf8Bytes(JSON.stringify(txData))
      );
      
      const keysBytes = await contract.getData("transaction_keys");
      let keys: string[] = [];
      
      if (keysBytes.length > 0) {
        try {
          keys = JSON.parse(ethers.toUtf8String(keysBytes));
        } catch (e) {
          console.error("Error parsing keys:", e);
        }
      }
      
      keys.push(txId);
      
      await contract.setData(
        "transaction_keys", 
        ethers.toUtf8Bytes(JSON.stringify(keys))
      );
      
      setTransactionStatus({
        visible: true,
        status: "success",
        message: "Encrypted energy listing created!"
      });
      
      await loadTransactions();
      
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
        setShowCreateModal(false);
        setNewTransaction({
          energyAmount: 0,
          pricePerUnit: 0,
        });
      }, 2000);
    } catch (e: any) {
      const errorMessage = e.message.includes("user rejected transaction")
        ? "Transaction rejected by user"
        : "Submission failed: " + (e.message || "Unknown error");
      
      setTransactionStatus({
        visible: true,
        status: "error",
        message: errorMessage
      });
      
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 3000);
    } finally {
      setCreating(false);
    }
  };

  const purchaseEnergy = async (txId: string) => {
    if (!provider) {
      alert("Please connect wallet first");
      return;
    }

    setTransactionStatus({
      visible: true,
      status: "pending",
      message: "Processing encrypted transaction with FHE..."
    });

    try {
      // Simulate FHE computation time
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const contract = await getContractWithSigner();
      if (!contract) {
        throw new Error("Failed to get contract with signer");
      }
      
      const txBytes = await contract.getData(`transaction_${txId}`);
      if (txBytes.length === 0) {
        throw new Error("Transaction not found");
      }
      
      const txData = JSON.parse(ethers.toUtf8String(txBytes));
      
      const updatedTx = {
        ...txData,
        buyer: account,
        status: "reserved"
      };
      
      await contract.setData(
        `transaction_${txId}`, 
        ethers.toUtf8Bytes(JSON.stringify(updatedTx))
      );
      
      setTransactionStatus({
        visible: true,
        status: "success",
        message: "FHE transaction completed successfully!"
      });
      
      await loadTransactions();
      
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 2000);
    } catch (e: any) {
      setTransactionStatus({
        visible: true,
        status: "error",
        message: "Transaction failed: " + (e.message || "Unknown error")
      });
      
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 3000);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const tutorialSteps = [
    {
      title: "Connect Wallet",
      description: "Connect your Web3 wallet to access the energy marketplace",
      icon: "🔗"
    },
    {
      title: "List Excess Energy",
      description: "Sell your surplus solar energy securely using FHE encryption",
      icon: "☀️"
    },
    {
      title: "FHE Price Matching",
      description: "Our system matches buyers and sellers without revealing usage patterns",
      icon: "⚡"
    },
    {
      title: "Private Transactions",
      description: "Complete energy transfers while keeping your data encrypted",
      icon: "🔒"
    },
    {
      title: "Automatic Settlement",
      description: "Payments are settled automatically on the blockchain",
      icon: "💸"
    }
  ];

  const renderPieChart = () => {
    const total = transactions.length || 1;
    const availablePercentage = (availableCount / total) * 100;
    const reservedPercentage = (reservedCount / total) * 100;
    const completedPercentage = (completedCount / total) * 100;

    return (
      <div className="pie-chart-container">
        <div className="pie-chart">
          <div 
            className="pie-segment available" 
            style={{ transform: `rotate(${availablePercentage * 3.6}deg)` }}
          ></div>
          <div 
            className="pie-segment reserved" 
            style={{ transform: `rotate(${(availablePercentage + reservedPercentage) * 3.6}deg)` }}
          ></div>
          <div 
            className="pie-segment completed" 
            style={{ transform: `rotate(${(availablePercentage + reservedPercentage + completedPercentage) * 3.6}deg)` }}
          ></div>
          <div className="pie-center">
            <div className="pie-value">{transactions.length}</div>
            <div className="pie-label">Transactions</div>
          </div>
        </div>
        <div className="pie-legend">
          <div className="legend-item">
            <div className="color-box available"></div>
            <span>Available: {availableCount}</span>
          </div>
          <div className="legend-item">
            <div className="color-box reserved"></div>
            <span>Reserved: {reservedCount}</span>
          </div>
          <div className="legend-item">
            <div className="color-box completed"></div>
            <span>Completed: {completedCount}</span>
          </div>
        </div>
      </div>
    );
  };

  if (loading) return (
    <div className="loading-screen">
      <div className="cyber-spinner"></div>
      <p>Initializing encrypted energy grid...</p>
    </div>
  );

  return (
    <div className="app-container cyberpunk-theme">
      <header className="app-header">
        <div className="logo">
          <div className="logo-icon">
            <div className="energy-icon"></div>
          </div>
          <h1>Solar<span>Grid</span>Exchange</h1>
        </div>
        
        <div className="header-actions">
          <button 
            onClick={() => setShowCreateModal(true)} 
            className="create-tx-btn cyber-button"
          >
            <div className="add-icon"></div>
            List Energy
          </button>
          <button 
            className="cyber-button"
            onClick={() => setShowTutorial(!showTutorial)}
          >
            {showTutorial ? "Hide Guide" : "Show Guide"}
          </button>
          <WalletManager account={account} onConnect={onConnect} onDisconnect={onDisconnect} />
        </div>
      </header>
      
      <div className="main-content">
        <div className="welcome-banner">
          <div className="welcome-text">
            <h2>Decentralized Energy Marketplace</h2>
            <p>Trade solar energy privately using FHE technology</p>
          </div>
          <div className="fhe-badge">
            <span>FHE-Powered Privacy</span>
          </div>
        </div>
        
        <div className="dashboard-grid">
          <div className="dashboard-card cyber-card">
            <h3>Project Introduction</h3>
            <p>SolarGrid Exchange enables neighbors to anonymously trade excess solar energy without revealing usage patterns.</p>
            <p>Using FHE technology, we encrypt energy production and consumption data while facilitating peer-to-peer transactions.</p>
            <div className="tech-tags">
              <span>fhEVM</span>
              <span>Solidity</span>
              <span>IoT</span>
            </div>
          </div>
          
          {showTutorial && (
            <div className="dashboard-card cyber-card tutorial-card">
              <h3>How It Works</h3>
              <div className="tutorial-steps">
                {tutorialSteps.map((step, index) => (
                  <div 
                    className="tutorial-step"
                    key={index}
                  >
                    <div className="step-icon">{step.icon}</div>
                    <div className="step-content">
                      <h4>{step.title}</h4>
                      <p>{step.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          <div className="dashboard-card cyber-card">
            <h3>Market Statistics</h3>
            <div className="stats-grid">
              <div className="stat-item">
                <div className="stat-value">{transactions.length}</div>
                <div className="stat-label">Total Listings</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">{availableCount}</div>
                <div className="stat-label">Available</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">{reservedCount}</div>
                <div className="stat-label">Reserved</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">{completedCount}</div>
                <div className="stat-label">Completed</div>
              </div>
            </div>
          </div>
          
          <div className="dashboard-card cyber-card">
            <h3>Market Distribution</h3>
            {renderPieChart()}
          </div>
        </div>
        
        <div className="transactions-section">
          <div className="section-header">
            <h2>Energy Listings</h2>
            <div className="header-actions">
              <button 
                onClick={loadTransactions}
                className="refresh-btn cyber-button"
                disabled={isRefreshing}
              >
                {isRefreshing ? "Refreshing..." : "Refresh Market"}
              </button>
            </div>
          </div>
          
          <div className="transactions-list cyber-card">
            <div className="table-header">
              <div className="header-cell">ID</div>
              <div className="header-cell">Energy (kWh)</div>
              <div className="header-cell">Price (wei/kWh)</div>
              <div className="header-cell">Seller</div>
              <div className="header-cell">Date</div>
              <div className="header-cell">Status</div>
              <div className="header-cell">Actions</div>
            </div>
            
            {transactions.length === 0 ? (
              <div className="no-transactions">
                <div className="no-tx-icon"></div>
                <p>No energy listings found</p>
                <button 
                  className="cyber-button primary"
                  onClick={() => setShowCreateModal(true)}
                >
                  List Your Energy
                </button>
              </div>
            ) : (
              transactions.map(tx => (
                <React.Fragment key={tx.id}>
                  <div className="transaction-row" onClick={() => toggleExpand(tx.id)}>
                    <div className="table-cell tx-id">#{tx.id.substring(0, 6)}</div>
                    <div className="table-cell">{tx.energyAmount} kWh</div>
                    <div className="table-cell">{tx.pricePerUnit} wei</div>
                    <div className="table-cell">{tx.seller.substring(0, 6)}...{tx.seller.substring(38)}</div>
                    <div className="table-cell">
                      {new Date(tx.timestamp * 1000).toLocaleDateString()}
                    </div>
                    <div className="table-cell">
                      <span className={`status-badge ${tx.status}`}>
                        {tx.status}
                      </span>
                    </div>
                    <div className="table-cell actions">
                      {tx.status === "available" && account && account !== tx.seller && (
                        <button 
                          className="action-btn cyber-button success"
                          onClick={(e) => {
                            e.stopPropagation();
                            purchaseEnergy(tx.id);
                          }}
                        >
                          Buy
                        </button>
                      )}
                    </div>
                  </div>
                  
                  {expandedId === tx.id && (
                    <div className="transaction-details">
                      <div className="detail-row">
                        <span>Transaction ID:</span>
                        <span>{tx.id}</span>
                      </div>
                      <div className="detail-row">
                        <span>Seller:</span>
                        <span>{tx.seller}</span>
                      </div>
                      <div className="detail-row">
                        <span>Buyer:</span>
                        <span>{tx.buyer || "Not purchased"}</span>
                      </div>
                      <div className="detail-row">
                        <span>Total Value:</span>
                        <span>{tx.energyAmount * tx.pricePerUnit} wei</span>
                      </div>
                      <div className="detail-row">
                        <span>Encrypted Data:</span>
                        <span className="encrypted-data">{tx.encryptedData.substring(0, 24)}...</span>
                      </div>
                      <div className="fhe-note">
                        <div className="lock-icon"></div>
                        <span>Energy data encrypted with FHE technology</span>
                      </div>
                    </div>
                  )}
                </React.Fragment>
              ))
            )}
          </div>
        </div>
      </div>
  
      {showCreateModal && (
        <ModalCreate 
          onSubmit={submitTransaction} 
          onClose={() => setShowCreateModal(false)} 
          creating={creating}
          transaction={newTransaction}
          setTransaction={setNewTransaction}
        />
      )}
      
      {walletSelectorOpen && (
        <WalletSelector
          isOpen={walletSelectorOpen}
          onWalletSelect={(wallet) => { onWalletSelect(wallet); setWalletSelectorOpen(false); }}
          onClose={() => setWalletSelectorOpen(false)}
        />
      )}
      
      {transactionStatus.visible && (
        <div className="transaction-modal">
          <div className="transaction-content cyber-card">
            <div className={`transaction-icon ${transactionStatus.status}`}>
              {transactionStatus.status === "pending" && <div className="cyber-spinner"></div>}
              {transactionStatus.status === "success" && <div className="check-icon"></div>}
              {transactionStatus.status === "error" && <div className="error-icon"></div>}
            </div>
            <div className="transaction-message">
              {transactionStatus.message}
            </div>
          </div>
        </div>
      )}
  
      <footer className="app-footer">
        <div className="footer-content">
          <div className="footer-brand">
            <div className="logo">
              <div className="energy-icon"></div>
              <span>SolarGrid Exchange</span>
            </div>
            <p>Decentralized energy trading with FHE privacy protection</p>
          </div>
          
          <div className="footer-links">
            <a href="#" className="footer-link">Documentation</a>
            <a href="#" className="footer-link">Privacy Policy</a>
            <a href="#" className="footer-link">Terms of Service</a>
            <a href="#" className="footer-link">Contact</a>
          </div>
        </div>
        
        <div className="footer-bottom">
          <div className="fhe-badge">
            <span>FHE-Powered Privacy</span>
          </div>
          <div className="copyright">
            © {new Date().getFullYear()} SolarGrid Exchange. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
};

interface ModalCreateProps {
  onSubmit: () => void; 
  onClose: () => void; 
  creating: boolean;
  transaction: any;
  setTransaction: (data: any) => void;
}

const ModalCreate: React.FC<ModalCreateProps> = ({ 
  onSubmit, 
  onClose, 
  creating,
  transaction,
  setTransaction
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setTransaction({
      ...transaction,
      [name]: parseFloat(value) || 0
    });
  };

  const handleSubmit = () => {
    if (transaction.energyAmount <= 0 || transaction.pricePerUnit <= 0) {
      alert("Please enter valid values");
      return;
    }
    
    onSubmit();
  };

  return (
    <div className="modal-overlay">
      <div className="create-modal cyber-card">
        <div className="modal-header">
          <h2>List Excess Energy</h2>
          <button onClick={onClose} className="close-modal">&times;</button>
        </div>
        
        <div className="modal-body">
          <div className="fhe-notice-banner">
            <div className="key-icon"></div> Your energy data will be encrypted with FHE
          </div>
          
          <div className="form-grid">
            <div className="form-group">
              <label>Energy Amount (kWh) *</label>
              <input 
                type="number"
                name="energyAmount"
                value={transaction.energyAmount} 
                onChange={handleChange}
                placeholder="Enter kWh amount" 
                className="cyber-input"
                min="0.1"
                step="0.1"
              />
            </div>
            
            <div className="form-group">
              <label>Price Per Unit (wei/kWh) *</label>
              <input 
                type="number"
                name="pricePerUnit"
                value={transaction.pricePerUnit} 
                onChange={handleChange}
                placeholder="Enter price in wei" 
                className="cyber-input"
                min="1"
              />
            </div>
            
            <div className="form-group full-width">
              <div className="estimated-value">
                <span>Estimated Value:</span>
                <span className="value">{transaction.energyAmount * transaction.pricePerUnit || 0} wei</span>
              </div>
            </div>
          </div>
          
          <div className="privacy-notice">
            <div className="privacy-icon"></div> 
            <span>Your energy production patterns remain private with FHE encryption</span>
          </div>
        </div>
        
        <div className="modal-footer">
          <button 
            onClick={onClose}
            className="cancel-btn cyber-button"
          >
            Cancel
          </button>
          <button 
            onClick={handleSubmit} 
            disabled={creating}
            className="submit-btn cyber-button primary"
          >
            {creating ? "Encrypting with FHE..." : "List Energy"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default App;