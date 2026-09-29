'use client';

import React, { useState, useEffect } from 'react';
import {
  useAccount, useConnect, useDisconnect, useReadContract,
  useWriteContract, useWaitForTransactionReceipt, useChainId
} from 'wagmi';
import { injected } from 'wagmi/connectors';
import { parseEther, formatEther } from 'viem';
import { formatAddress, formatDate } from '@/utils/formatters';
import {
  CheckCircle2, XCircle, ShieldCheck, Award, PlusCircle, Search, Copy,
  ExternalLink, QrCode, RefreshCw, AlertTriangle, UserCheck, Layers,
  Sparkles, Wallet, LogOut, Lock, Gift, CheckCheck
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { QRCodeSVG } from 'qrcode.react';

import deploymentData from '@/contracts/deployment.json';
import proofOfAchievementABI from '@/contracts/ProofOfAchievementABI.json';

const CONTRACT_ADDRESS = (process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || deploymentData.contractAddress) as `0x${string}`;
const MONAD_EXPLORER_URL = process.env.NEXT_PUBLIC_MONAD_EXPLORER_URL || 'https://testnet.monadexplorer.com';

interface AchievementData {
  id: bigint;
  studentName: string;
  studentWallet: string;
  title: string;
  description: string;
  issuer: string;
  issuedAt: bigint;
  reward: bigint;
  rewardClaimed: boolean;
  exists: boolean;
  revoked: boolean;
}

const SEED_ACHIEVEMENTS: Record<string, AchievementData> = {
  '1': {
    id: BigInt(1),
    studentName: 'Rahul Sharma',
    studentWallet: '0xEB2166ec84F6273dF37cD7a5403494EeF641c113',
    title: 'Web3 Monad Developer Certification',
    description: 'Awarded for demonstrating excellence in high-throughput EVM smart contract design and credential verification during the 2026 Buildathon.',
    issuer: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
    issuedAt: BigInt(1743200000),
    reward: parseEther('0.01'),
    rewardClaimed: false,
    exists: true,
    revoked: false,
  },
  '2': {
    id: BigInt(2),
    studentName: 'Ananya Patel',
    studentWallet: '0x3C44CdD1605347165c47748D840244640B79679f',
    title: 'DeFi Protocol Security Masterclass',
    description: 'Successfully audited and deployed secure smart contract protocols on Monad Testnet.',
    issuer: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
    issuedAt: BigInt(1743243200),
    reward: BigInt(0),
    rewardClaimed: false,
    exists: true,
    revoked: false,
  }
};

function loadLocalAchievements(): Record<string, AchievementData> {
  if (typeof window === 'undefined') return SEED_ACHIEVEMENTS;
  try {
    const saved = localStorage.getItem('poa_demo_achievements');
    if (!saved) return SEED_ACHIEVEMENTS;
    const parsed = JSON.parse(saved);
    const result: Record<string, AchievementData> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, any>)) {
      result[k] = {
        ...v,
        id: BigInt(v.id),
        issuedAt: BigInt(v.issuedAt),
        reward: BigInt(v.reward),
      };
    }
    return { ...SEED_ACHIEVEMENTS, ...result };
  } catch {
    return SEED_ACHIEVEMENTS;
  }
}

// Transaction receipt display component
function TxReceipt({
  type,
  txHash,
  rewardEth,
  onClose,
}: {
  type: 'issued' | 'claimed';
  txHash: string;
  rewardEth?: string;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="glass-panel p-6 rounded-2xl border border-emerald-500/30 max-w-sm w-full space-y-4 shadow-2xl shadow-emerald-500/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-emerald-400">
            <CheckCheck className="w-5 h-5" />
            <h3 className="font-bold text-white text-base">
              {type === 'issued' ? 'Achievement Issued!' : 'Reward Claimed!'}
            </h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xs px-2 py-1 rounded-md bg-white/5">✕</button>
        </div>

        <div className="bg-slate-950/80 rounded-xl p-4 space-y-3 border border-white/10 text-xs">
          <div className="flex items-center justify-center space-x-2 text-emerald-400 font-semibold">
            <CheckCircle2 className="w-5 h-5" />
            <span>Transaction confirmed on Monad</span>
          </div>

          {rewardEth && (
            <div className="text-center pt-1 pb-1">
              {type === 'issued' ? (
                <span className="text-purple-300 font-mono-custom">
                  💎 Reward locked in contract: <strong>{rewardEth} MON</strong>
                </span>
              ) : (
                <span className="text-emerald-300 font-mono-custom">
                  🎉 <strong>{rewardEth} MON</strong> transferred to recipient
                </span>
              )}
            </div>
          )}

          <div className="flex items-center justify-between pt-2 border-t border-white/10">
            <span className="text-slate-400">TX Hash</span>
            <span className="font-mono-custom text-slate-200">{formatAddress(txHash, 6)}</span>
          </div>
        </div>

        <a
          href={`${MONAD_EXPLORER_URL}/tx/${txHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center space-x-2 w-full bg-purple-600 hover:bg-purple-500 text-white py-2 rounded-xl text-xs font-semibold transition-all"
        >
          <ExternalLink className="w-4 h-4" />
          <span>View on Monad Explorer</span>
        </a>

        <button
          onClick={onClose}
          className="w-full bg-slate-900 hover:bg-slate-800 text-slate-400 py-2 rounded-xl text-xs font-semibold transition-all"
        >
          Close
        </button>
      </div>
    </div>
  );
}

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<'verify' | 'issue' | 'admin'>('verify');
  const [searchId, setSearchId] = useState<string>('1');
  const [queryId, setQueryId] = useState<bigint | null>(BigInt(1));
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [simulatedAddress, setSimulatedAddress] = useState<string | null>(null);

  // Form State
  const [formStudentName, setFormStudentName] = useState('');
  const [formStudentWallet, setFormStudentWallet] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formRewardMON, setFormRewardMON] = useState('0');

  // Admin / Revoke State
  const [revokeIdInput, setRevokeIdInput] = useState('');
  const [newIssuerAddress, setNewIssuerAddress] = useState('');

  // TX receipt display
  const [txReceipt, setTxReceipt] = useState<{ type: 'issued' | 'claimed'; hash: string; rewardEth?: string } | null>(null);

  // Ref to track pending on-chain issue details
  const pendingIssueRef = React.useRef<{
    studentName: string;
    studentWallet: string;
    title: string;
    description: string;
    rewardWei: bigint;
    rewardMON: string;
  } | null>(null);

  // Local achievements store initialized from localStorage
  const [localAchievements, setLocalAchievements] = useState<Record<string, AchievementData>>(() => loadLocalAchievements());

  // Save to localStorage whenever localAchievements changes
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const serializable: Record<string, any> = {};
      for (const [k, v] of Object.entries(localAchievements)) {
        serializable[k] = {
          ...v,
          id: v.id.toString(),
          issuedAt: v.issuedAt.toString(),
          reward: v.reward.toString(),
        };
      }
      localStorage.setItem('poa_demo_achievements', JSON.stringify(serializable));
    } catch { /* ignore storage errors */ }
  }, [localAchievements]);

  const [showQrModal, setShowQrModal] = useState(false);

  // Wagmi hooks
  const { address: wagmiAddress, isConnected: wagmiConnected } = useAccount();
  const { connectors, connect } = useConnect();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();

  useEffect(() => { setMounted(true); }, []);

  const activeAddress = wagmiAddress || simulatedAddress;
  const isUserConnected = wagmiConnected || !!simulatedAddress;

  // Read contract
  const { data: totalAchievementsData, refetch: refetchTotal } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: proofOfAchievementABI,
    functionName: 'getTotalAchievements',
  });

  const { data: contractAchievement, refetch: refetchAch } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: proofOfAchievementABI,
    functionName: 'getAchievement',
    args: queryId !== null ? [queryId] : undefined,
    query: { enabled: queryId !== null },
  });

  const { data: contractBalance } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: proofOfAchievementABI,
    functionName: 'getContractBalance',
  });

  // Write hooks — separate for issue and claim to track independently
  const {
    data: issueTxHash,
    isPending: isIssuePending,
    writeContract: writeIssue,
    reset: resetIssue,
  } = useWriteContract();

  const {
    data: claimTxHash,
    isPending: isClaimPending,
    writeContract: writeClaim,
    reset: resetClaim,
  } = useWriteContract();

  const { isLoading: isIssueWaiting, isSuccess: isIssueSuccess } =
    useWaitForTransactionReceipt({ hash: issueTxHash });

  const { isLoading: isClaimWaiting, isSuccess: isClaimSuccess } =
    useWaitForTransactionReceipt({ hash: claimTxHash });

  // On issue confirmed
  useEffect(() => {
    if (isIssueSuccess && issueTxHash) {
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
      refetchTotal();

      const pending = pendingIssueRef.current;
      const existingIds = Object.keys(localAchievements).map(Number);
      const nextId = (existingIds.length > 0 ? Math.max(...existingIds) + 1 : 1).toString();

      if (pending) {
        const newAch: AchievementData = {
          id: BigInt(nextId),
          studentName: pending.studentName,
          studentWallet: pending.studentWallet,
          title: pending.title,
          description: pending.description,
          issuer: activeAddress || '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
          issuedAt: BigInt(Math.floor(Date.now() / 1000)),
          reward: pending.rewardWei,
          rewardClaimed: false,
          exists: true,
          revoked: false,
        };
        setLocalAchievements(prev => ({ ...prev, [nextId]: newAch }));
        setSearchId(nextId);
        setQueryId(BigInt(nextId));
        setActiveTab('verify');
        pendingIssueRef.current = null;
      } else {
        setSearchId(nextId);
        setQueryId(BigInt(nextId));
        setActiveTab('verify');
      }

      if (queryId !== null) refetchAch();

      const rewardVal = pending ? parseFloat(pending.rewardMON) : parseFloat(formRewardMON);
      setTxReceipt({
        type: 'issued',
        hash: issueTxHash,
        rewardEth: rewardVal > 0 ? (pending ? pending.rewardMON : formRewardMON) : undefined,
      });

      // Clear form fields
      setFormStudentName('');
      setFormStudentWallet('');
      setFormTitle('');
      setFormDescription('');
      setFormRewardMON('0');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isIssueSuccess, issueTxHash]);

  // On claim confirmed
  useEffect(() => {
    if (isClaimSuccess && claimTxHash && currentAch) {
      confetti({ particleCount: 80, spread: 60, colors: ['#10b981', '#6366f1'], origin: { y: 0.6 } });
      refetchAch();

      const idStr = currentAch.id.toString();
      setLocalAchievements(prev => {
        if (!prev[idStr]) return prev;
        return {
          ...prev,
          [idStr]: { ...prev[idStr], rewardClaimed: true }
        };
      });

      const rewardEth = formatEther(currentAch.reward);
      setTxReceipt({ type: 'claimed', hash: claimTxHash, rewardEth });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isClaimSuccess, claimTxHash]);

  // Resolve displayed achievement from contract or local store
  const currentAch: AchievementData | null = React.useMemo(() => {
    if (contractAchievement && (contractAchievement as any).exists) {
      const c = contractAchievement as any;
      return {
        id: c.id, studentName: c.studentName, studentWallet: c.studentWallet,
        title: c.title, description: c.description, issuer: c.issuer,
        issuedAt: c.issuedAt, reward: c.reward, rewardClaimed: c.rewardClaimed,
        exists: c.exists, revoked: c.revoked,
      };
    }
    if (queryId !== null && localAchievements[queryId.toString()]) {
      return localAchievements[queryId.toString()];
    }
    return null;
  }, [contractAchievement, queryId, localAchievements]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseInt(searchId.trim());
    if (!isNaN(parsed) && parsed > 0) setQueryId(BigInt(parsed));
    else setQueryId(null);
  };

  const handleFillDemoData = () => {
    setFormStudentName('Priya Sundaram');
    setFormStudentWallet(activeAddress || '0xEB2166ec84F6273dF37cD7a5403494EeF641c113');
    setFormTitle('Monad Web3 Hackathon Finalist 2026');
    setFormDescription('Demonstrated outstanding technical innovation, smart contract execution, and verified credential architecture on Monad Network.');
    setFormRewardMON('0.01');
  };

  const handleIssueAchievement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formStudentName || !formStudentWallet || !formTitle) return;

    const rewardFloat = parseFloat(formRewardMON) || 0;
    if (rewardFloat < 0) return;
    const rewardWei = rewardFloat > 0 ? parseEther(formRewardMON as `${number}`) : BigInt(0);

    const existingIds = Object.keys(localAchievements).map(Number);
    const maxExisting = existingIds.length > 0 ? Math.max(...existingIds) : 0;
    const nextId = (maxExisting + 1).toString();

    const newAch: AchievementData = {
      id: BigInt(nextId),
      studentName: formStudentName,
      studentWallet: formStudentWallet,
      title: formTitle,
      description: formDescription,
      issuer: activeAddress || '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
      issuedAt: BigInt(Math.floor(Date.now() / 1000)),
      reward: rewardWei,
      rewardClaimed: false,
      exists: true,
      revoked: false,
    };

    if (wagmiConnected) {
      pendingIssueRef.current = {
        studentName: formStudentName,
        studentWallet: formStudentWallet,
        title: formTitle,
        description: formDescription,
        rewardWei,
        rewardMON: formRewardMON,
      };

      writeIssue({
        address: CONTRACT_ADDRESS,
        abi: proofOfAchievementABI,
        functionName: 'issueAchievement',
        args: [formStudentName, formStudentWallet as `0x${string}`, formTitle, formDescription],
        value: rewardWei,
      });
    } else {
      setLocalAchievements(prev => ({ ...prev, [nextId]: newAch }));
      setSearchId(nextId);
      setQueryId(BigInt(nextId));
      setActiveTab('verify');
      confetti({ particleCount: 90, spread: 60, origin: { y: 0.6 } });
      setTxReceipt({
        type: 'issued',
        hash: `0x${Array.from({length: 64}, () => Math.floor(Math.random()*16).toString(16)).join('')}`,
        rewardEth: rewardFloat > 0 ? formRewardMON : undefined,
      });
      // Clear form
      setFormStudentName('');
      setFormStudentWallet('');
      setFormTitle('');
      setFormDescription('');
      setFormRewardMON('0');
    }
  };

  const handleClaimReward = () => {
    if (!currentAch) return;
    if (wagmiConnected) {
      writeClaim({
        address: CONTRACT_ADDRESS,
        abi: proofOfAchievementABI,
        functionName: 'claimReward',
        args: [currentAch.id],
      });
    } else {
      // Local demo claim
      const id = currentAch.id.toString();
      setLocalAchievements(prev => ({
        ...prev,
        [id]: { ...prev[id], rewardClaimed: true }
      }));
      confetti({ particleCount: 80, spread: 60, colors: ['#10b981', '#6366f1'], origin: { y: 0.6 } });
      setTxReceipt({
        type: 'claimed',
        hash: `0x${Math.random().toString(16).slice(2).padEnd(64, '0')}`,
        rewardEth: formatEther(currentAch.reward),
      });
    }
  };

  const handleRevokeAchievement = (idStr: string) => {
    const parsedId = parseInt(idStr);
    if (isNaN(parsedId)) return;
    if (wagmiConnected) {
      writeIssue({
        address: CONTRACT_ADDRESS,
        abi: proofOfAchievementABI,
        functionName: 'revokeAchievement',
        args: [BigInt(parsedId)],
      });
    } else {
      setLocalAchievements(prev => ({
        ...prev,
        [idStr]: { ...prev[idStr], revoked: true }
      }));
    }
  };

  const maxLocalId = Math.max(0, ...Object.keys(localAchievements).map(Number));
  const totalCount = Math.max(
    totalAchievementsData ? Number(totalAchievementsData) : 0,
    maxLocalId,
    Object.keys(localAchievements).length
  );


  const contractBalanceFormatted = contractBalance
    ? formatEther(contractBalance as bigint)
    : null;

  // Reward display helpers
  const rewardDisplay = (ach: AchievementData) => {
    if (ach.reward === BigInt(0)) return null;
    return formatEther(ach.reward);
  };

  const canClaim = (ach: AchievementData): 'claim' | 'connect_recipient' | 'claimed' | 'none' => {
    if (ach.reward === BigInt(0)) return 'none';
    if (ach.rewardClaimed) return 'claimed';
    if (!isUserConnected) return 'connect_recipient';
    const walletLower = (activeAddress || '').toLowerCase();
    if (walletLower !== ach.studentWallet.toLowerCase()) return 'connect_recipient';
    return 'claim';
  };

  if (!mounted) {
    return (
      <div className="min-h-screen bg-[#08090e] flex items-center justify-center">
        <RefreshCw className="w-6 h-6 animate-spin text-purple-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#08090e] bg-monad-glow text-slate-100 flex flex-col font-sans">
      {/* Header Bar */}
      <header className="sticky top-0 z-40 glass-panel border-b border-white/10 backdrop-blur-md px-4 lg:px-8 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 p-0.5 flex items-center justify-center shadow-lg shadow-purple-500/20">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <Award className="w-5 h-5 text-purple-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-purple-300 bg-clip-text text-transparent">
                  Proof of Achievement
                </h1>
                <span className="text-[10px] font-mono-custom bg-purple-500/20 border border-purple-500/40 text-purple-300 px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Monad Protocol
                </span>
              </div>
              <p className="text-xs text-slate-400">Blockchain-Backed Credential Verification</p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="hidden md:flex items-center bg-slate-900/80 border border-white/10 rounded-lg p-1 space-x-1">
              {(['verify', 'issue', 'admin'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                    activeTab === tab
                      ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {tab === 'verify' && <Search className="w-3.5 h-3.5" />}
                  {tab === 'issue' && <PlusCircle className="w-3.5 h-3.5" />}
                  {tab === 'admin' && <Layers className="w-3.5 h-3.5" />}
                  <span className="capitalize">{tab === 'verify' ? 'Verify Credential' : tab === 'issue' ? 'Issue Achievement' : 'Registry Admin'}</span>
                </button>
              ))}
            </div>

            {isUserConnected ? (
              <div className="flex items-center space-x-2">
                <div className="hidden sm:flex flex-col items-end">
                  <span className="text-xs font-mono-custom text-slate-200 font-semibold">{formatAddress(activeAddress || '')}</span>
                  <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    {wagmiConnected ? (chainId === 10143 ? 'Monad Testnet' : `Chain: ${chainId}`) : 'Demo Connected'}
                  </span>
                </div>
                <button
                  onClick={() => { disconnect(); setSimulatedAddress(null); }}
                  className="p-2 rounded-lg bg-slate-900 border border-white/10 text-slate-400 hover:text-red-400 hover:border-red-500/30 transition-all"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowConnectModal(true)}
                className="flex items-center space-x-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white px-4 py-2 rounded-lg text-xs font-semibold shadow-lg shadow-purple-600/25 transition-all"
              >
                <Wallet className="w-4 h-4" />
                <span>Connect Wallet</span>
              </button>
            )}
          </div>
        </div>

        {/* Mobile Nav */}
        <div className="flex md:hidden items-center justify-around mt-3 pt-2 border-t border-white/10">
          {(['verify', 'issue', 'admin'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex items-center space-x-1.5 px-3 py-1 rounded-md text-xs ${activeTab === tab ? 'bg-purple-600 text-white' : 'text-slate-400'}`}
            >
              {tab === 'verify' && <Search className="w-3.5 h-3.5" />}
              {tab === 'issue' && <PlusCircle className="w-3.5 h-3.5" />}
              {tab === 'admin' && <Layers className="w-3.5 h-3.5" />}
              <span className="capitalize">{tab === 'verify' ? 'Verify' : tab === 'issue' ? 'Issue' : 'Admin'}</span>
            </button>
          ))}
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 lg:px-8 py-8">

        {/* Stats Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="glass-card p-4 rounded-xl flex items-center space-x-4 border border-white/10">
            <div className="p-3 bg-indigo-500/10 rounded-lg text-indigo-400"><Award className="w-6 h-6" /></div>
            <div>
              <p className="text-xs text-slate-400 font-medium">Total Credentials</p>
              <h3 className="text-xl font-bold font-mono-custom text-white">{totalCount}</h3>
            </div>
          </div>
          <div className="glass-card p-4 rounded-xl flex items-center space-x-4 border border-white/10">
            <div className="p-3 bg-emerald-500/10 rounded-lg text-emerald-400"><ShieldCheck className="w-6 h-6" /></div>
            <div>
              <p className="text-xs text-slate-400 font-medium">Blockchain Network</p>
              <h3 className="text-sm font-semibold text-white">Monad Testnet</h3>
            </div>
          </div>
          <div className="glass-card p-4 rounded-xl flex items-center space-x-4 border border-white/10">
            <div className="p-3 bg-purple-500/10 rounded-lg text-purple-400"><UserCheck className="w-6 h-6" /></div>
            <div>
              <p className="text-xs text-slate-400 font-medium">Contract Address</p>
              <h3 className="text-xs font-mono-custom text-purple-300 truncate max-w-[150px]" title={CONTRACT_ADDRESS}>{formatAddress(CONTRACT_ADDRESS)}</h3>
            </div>
          </div>
          <div className="glass-card p-4 rounded-xl flex items-center space-x-4 border border-white/10">
            <div className="p-3 bg-yellow-500/10 rounded-lg text-yellow-400"><Gift className="w-6 h-6" /></div>
            <div>
              <p className="text-xs text-slate-400 font-medium">Contract Balance</p>
              <h3 className="text-sm font-bold font-mono-custom text-yellow-300">
                {contractBalanceFormatted ? `${parseFloat(contractBalanceFormatted).toFixed(4)} MON` : '—'}
              </h3>
            </div>
          </div>
        </div>

        {/* === TAB 1: VERIFY === */}
        {activeTab === 'verify' && (
          <div className="space-y-6">
            <div className="glass-panel p-6 rounded-2xl border border-white/10 max-w-3xl mx-auto">
              <h2 className="text-lg font-bold text-white mb-2 flex items-center space-x-2">
                <Search className="w-5 h-5 text-purple-400" />
                <span>Verify Achievement Credential</span>
              </h2>
              <p className="text-xs text-slate-400 mb-4">Enter an Achievement ID to verify tamper-proof on-chain credential and check reward status.</p>
              <form onSubmit={handleSearch} className="flex gap-2">
                <input
                  type="text"
                  value={searchId}
                  onChange={(e) => setSearchId(e.target.value)}
                  placeholder="Enter Achievement ID (e.g. 1, 2)"
                  className="flex-1 bg-slate-950/80 border border-white/15 focus:border-purple-500 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none font-mono-custom"
                />
                <button
                  type="submit"
                  className="bg-purple-600 hover:bg-purple-500 text-white px-6 py-3 rounded-xl font-semibold text-sm flex items-center space-x-2 shadow-lg shadow-purple-600/30 transition-all"
                >
                  <Search className="w-4 h-4" />
                  <span>Verify ID</span>
                </button>
              </form>
              <div className="flex items-center flex-wrap gap-1.5 mt-3 text-xs text-slate-400">
                <span className="mr-1">Quick load:</span>
                {Object.keys(localAchievements).sort((a,b) => Number(a)-Number(b)).map((id) => (
                  <button key={id} onClick={() => { setSearchId(id); setQueryId(BigInt(id)); }}
                    className="px-2.5 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-md font-mono-custom text-purple-300 transition-all">
                    #{id}
                  </button>
                ))}
              </div>
            </div>

            {currentAch ? (
              <div className="max-w-3xl mx-auto space-y-4">
                {/* Certificate Card */}
                <div className={`certificate-frame rounded-2xl p-8 glass-panel shadow-2xl ${currentAch.revoked ? 'border-red-500/40' : 'border-purple-500/30'}`}>
                  <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/10">
                    {currentAch.revoked ? (
                      <div className="flex items-center space-x-2 bg-red-500/10 border border-red-500/30 text-red-400 px-3.5 py-1.5 rounded-full text-xs font-semibold">
                        <XCircle className="w-4 h-4" /><span>REVOKED CREDENTIAL</span>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-3.5 py-1.5 rounded-full text-xs font-semibold">
                        <CheckCircle2 className="w-4 h-4" /><span>VERIFIED ON MONAD BLOCKCHAIN</span>
                      </div>
                    )}
                    <div className="text-right">
                      <span className="text-[11px] font-mono-custom text-slate-400">Achievement ID</span>
                      <p className="text-base font-bold font-mono-custom text-purple-400">#{currentAch.id.toString()}</p>
                    </div>
                  </div>

                  <div className="text-center my-6">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 p-0.5 mx-auto mb-4 shadow-xl shadow-purple-600/30 flex items-center justify-center">
                      <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
                        <Award className="w-8 h-8 text-purple-400" />
                      </div>
                    </div>
                    <span className="text-xs uppercase tracking-widest text-purple-400 font-semibold">Certificate of Achievement</span>
                    <h3 className="text-2xl font-extrabold text-white mt-1 mb-2">{currentAch.title}</h3>
                    <p className="text-sm text-slate-300 max-w-xl mx-auto leading-relaxed">{currentAch.description}</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-6 p-4 bg-slate-950/60 rounded-xl border border-white/5">
                    <div>
                      <span className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">Recipient Name</span>
                      <p className="text-base font-bold text-white mt-0.5">{currentAch.studentName}</p>
                    </div>
                    <div>
                      <span className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">Student Wallet</span>
                      <p className="text-xs font-mono-custom text-slate-200 mt-0.5">{formatAddress(currentAch.studentWallet)}</p>
                    </div>
                    <div>
                      <span className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">Authorized Issuer</span>
                      <p className="text-xs font-mono-custom text-slate-200 mt-0.5">{formatAddress(currentAch.issuer)}</p>
                    </div>
                    <div>
                      <span className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">Issue Timestamp</span>
                      <p className="text-xs text-slate-200 mt-0.5">{formatDate(currentAch.issuedAt)}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-white/10">
                    <button onClick={() => setShowQrModal(true)}
                      className="flex items-center space-x-2 text-xs font-medium text-purple-300 hover:text-white bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 px-4 py-2 rounded-lg transition-all">
                      <QrCode className="w-4 h-4" /><span>Verification QR Code</span>
                    </button>
                    <a href={`${MONAD_EXPLORER_URL}/address/${CONTRACT_ADDRESS}`} target="_blank" rel="noopener noreferrer"
                      className="flex items-center space-x-2 text-xs font-medium text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 border border-white/10 px-4 py-2 rounded-lg transition-all">
                      <ExternalLink className="w-4 h-4 text-purple-400" /><span>Monad Explorer</span>
                    </a>
                  </div>
                </div>

                {/* Reward Panel */}
                <div className={`glass-panel rounded-2xl p-6 border ${
                  currentAch.reward === BigInt(0) ? 'border-white/10' :
                  currentAch.rewardClaimed ? 'border-slate-500/30' : 'border-yellow-500/30'
                }`}>
                  <h3 className="text-sm font-bold text-white mb-4 flex items-center space-x-2">
                    <Gift className={`w-4 h-4 ${currentAch.reward === BigInt(0) ? 'text-slate-500' : currentAch.rewardClaimed ? 'text-slate-400' : 'text-yellow-400'}`} />
                    <span>On-Chain Reward</span>
                  </h3>

                  {currentAch.reward === BigInt(0) ? (
                    <p className="text-xs text-slate-500 italic">No reward attached to this achievement.</p>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-slate-400">Reward Amount</p>
                          <p className="text-xl font-bold font-mono-custom text-yellow-300">{formatEther(currentAch.reward)} MON</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-slate-400">Status</p>
                          {currentAch.rewardClaimed ? (
                            <span className="flex items-center space-x-1 text-slate-400 text-xs font-semibold bg-slate-800 border border-slate-600/30 px-2.5 py-1 rounded-full">
                              <CheckCheck className="w-3.5 h-3.5" /><span>CLAIMED</span>
                            </span>
                          ) : (
                            <span className="flex items-center space-x-1 text-emerald-400 text-xs font-semibold bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 rounded-full">
                              <Gift className="w-3.5 h-3.5" /><span>AVAILABLE</span>
                            </span>
                          )}
                        </div>
                      </div>

                      <p className="text-[11px] text-slate-500">
                        {currentAch.rewardClaimed
                          ? 'This reward has been transferred to the achievement recipient.'
                          : 'This reward is currently held by the Proof of Achievement smart contract.'}
                      </p>

                      {/* Claim button logic */}
                      {(() => {
                        const state = canClaim(currentAch);
                        if (state === 'claim') {
                          return (
                            <button
                              onClick={handleClaimReward}
                              disabled={isClaimPending || isClaimWaiting}
                              className="w-full flex items-center justify-center space-x-2 bg-gradient-to-r from-yellow-600 to-amber-500 hover:from-yellow-500 hover:to-amber-400 disabled:opacity-50 text-white font-bold py-3 rounded-xl text-sm shadow-lg shadow-yellow-600/30 transition-all"
                            >
                              {isClaimPending || isClaimWaiting ? (
                                <><RefreshCw className="w-4 h-4 animate-spin" /><span>Confirming on Monad...</span></>
                              ) : (
                                <><Gift className="w-4 h-4" /><span>Claim {formatEther(currentAch.reward)} MON Reward</span></>
                              )}
                            </button>
                          );
                        }
                        if (state === 'connect_recipient') {
                          return (
                            <div className="flex items-center space-x-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-300">
                              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                              <span>Connect the recipient wallet (<span className="font-mono-custom">{formatAddress(currentAch.studentWallet)}</span>) to claim this reward.</span>
                            </div>
                          );
                        }
                        return null;
                      })()}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="max-w-xl mx-auto glass-panel p-8 rounded-2xl text-center border border-white/10">
                <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto mb-3" />
                <h3 className="text-lg font-bold text-white mb-1">Achievement Not Found</h3>
                <p className="text-xs text-slate-400">No credential exists for ID #{searchId}.</p>
              </div>
            )}
          </div>
        )}

        {/* === TAB 2: ISSUE === */}
        {activeTab === 'issue' && (
          <div className="max-w-2xl mx-auto glass-panel p-8 rounded-2xl border border-white/10 shadow-2xl">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/10">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center space-x-2">
                  <PlusCircle className="w-5 h-5 text-purple-400" />
                  <span>Issue New Achievement</span>
                </h2>
                <p className="text-xs text-slate-400 mt-1">Record credentials permanently on the Monad blockchain. Optionally lock a MON reward.</p>
              </div>
              <button type="button" onClick={handleFillDemoData}
                className="flex items-center space-x-1.5 text-xs font-semibold bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 border border-purple-500/40 px-3 py-1.5 rounded-lg transition-all">
                <Sparkles className="w-3.5 h-3.5" /><span>⚡ Demo Data</span>
              </button>
            </div>

            <form onSubmit={handleIssueAchievement} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Student Full Name *</label>
                <input type="text" required placeholder="e.g. Rahul Sharma" value={formStudentName}
                  onChange={(e) => setFormStudentName(e.target.value)}
                  className="w-full bg-slate-950/80 border border-white/15 focus:border-purple-500 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Student Wallet Address *</label>
                <input type="text" required placeholder="0x..." value={formStudentWallet}
                  onChange={(e) => setFormStudentWallet(e.target.value)}
                  className="w-full bg-slate-950/80 border border-white/15 focus:border-purple-500 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none font-mono-custom" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Achievement Title *</label>
                <input type="text" required placeholder="e.g. Web3 SkillBuildZ 2026" value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full bg-slate-950/80 border border-white/15 focus:border-purple-500 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Description / Metadata</label>
                <textarea rows={3} placeholder="Achievement criteria, track details..." value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full bg-slate-950/80 border border-white/15 focus:border-purple-500 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none" />
              </div>

              {/* Reward Field */}
              <div className="p-4 bg-yellow-500/5 border border-yellow-500/20 rounded-xl space-y-2">
                <label className="block text-xs font-semibold text-yellow-300 flex items-center space-x-2">
                  <Gift className="w-3.5 h-3.5" />
                  <span>Reward in MON (optional)</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="0.001"
                    placeholder="0"
                    value={formRewardMON}
                    onChange={(e) => setFormRewardMON(e.target.value)}
                    className="w-full bg-slate-950/80 border border-yellow-500/30 focus:border-yellow-400 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none font-mono-custom"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-yellow-400 font-bold">MON</span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Optional on-chain reward for this achievement. Enter 0 to issue without a reward. The MON will be locked in the smart contract until the recipient claims it.
                </p>
                {parseFloat(formRewardMON) > 0 && (
                  <div className="flex items-center space-x-2 text-[11px] text-yellow-300 bg-yellow-500/10 px-3 py-2 rounded-lg border border-yellow-500/20">
                    <Lock className="w-3 h-3" />
                    <span><strong>{formRewardMON} MON</strong> will be locked in the smart contract and claimable only by the student wallet.</span>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-white/10 flex items-center justify-between">
                <span className="text-xs text-slate-400">
                  {isUserConnected ? 'Authorized Issuer Connected' : 'Demo Mode Active'}
                </span>
                <button type="submit" disabled={isIssuePending || isIssueWaiting}
                  className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 text-white font-semibold text-sm px-6 py-3 rounded-xl shadow-lg shadow-purple-600/30 flex items-center space-x-2 transition-all">
                  {isIssuePending || isIssueWaiting ? (
                    <><RefreshCw className="w-4 h-4 animate-spin" /><span>Minting on Monad...</span></>
                  ) : (
                    <><Award className="w-4 h-4" /><span>Mint Achievement</span>{parseFloat(formRewardMON) > 0 && <span>+ Lock {formRewardMON} MON</span>}</>
                  )}
                </button>
              </div>

              {issueTxHash && (
                <div className="mt-2 p-3 bg-purple-500/10 border border-purple-500/30 rounded-xl text-xs text-purple-300 flex items-center justify-between">
                  <span>TX: {formatAddress(issueTxHash)}</span>
                  <a href={`${MONAD_EXPLORER_URL}/tx/${issueTxHash}`} target="_blank" rel="noopener noreferrer"
                    className="flex items-center space-x-1 underline hover:text-white">
                    <span>Explorer</span><ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
            </form>
          </div>
        )}

        {/* === TAB 3: ADMIN === */}
        {activeTab === 'admin' && (
          <div className="space-y-6 max-w-4xl mx-auto">
            <div className="glass-panel p-6 rounded-2xl border border-white/10">
              <h3 className="text-lg font-bold text-white mb-2 flex items-center space-x-2">
                <Lock className="w-5 h-5 text-red-400" /><span>Revoke Achievement Credential</span>
              </h3>
              <p className="text-xs text-slate-400 mb-4">Only contract owner or original issuer can revoke an achievement.</p>
              <div className="flex gap-3">
                <input type="text" placeholder="Achievement ID (e.g. 1)" value={revokeIdInput}
                  onChange={(e) => setRevokeIdInput(e.target.value)}
                  className="flex-1 bg-slate-950/80 border border-white/15 focus:border-red-500 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none font-mono-custom" />
                <button onClick={() => handleRevokeAchievement(revokeIdInput)}
                  className="bg-red-600 hover:bg-red-500 text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition-all">
                  Revoke
                </button>
              </div>
            </div>

            <div className="glass-panel p-6 rounded-2xl border border-white/10">
              <h3 className="text-lg font-bold text-white mb-2 flex items-center space-x-2">
                <UserCheck className="w-5 h-5 text-indigo-400" /><span>Authorize New Issuer</span>
              </h3>
              <p className="text-xs text-slate-400 mb-4">Grant credential minting privileges to a new address.</p>
              <div className="flex gap-3">
                <input type="text" placeholder="Issuer Wallet Address (0x...)" value={newIssuerAddress}
                  onChange={(e) => setNewIssuerAddress(e.target.value)}
                  className="flex-1 bg-slate-950/80 border border-white/15 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none font-mono-custom" />
                <button
                  onClick={() => { if (newIssuerAddress) writeIssue({ address: CONTRACT_ADDRESS, abi: proofOfAchievementABI, functionName: 'authorizeIssuer', args: [newIssuerAddress as `0x${string}`] }); }}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition-all">
                  Authorize
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* CONNECT WALLET MODAL */}
      {showConnectModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel p-6 rounded-2xl border border-white/10 max-w-md w-full space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="text-lg font-bold text-white flex items-center space-x-2">
                <Wallet className="w-5 h-5 text-purple-400" /><span>Connect Your Wallet</span>
              </h3>
              <button onClick={() => setShowConnectModal(false)} className="text-slate-400 hover:text-white text-xs px-2 py-1 rounded-md bg-white/5">✕</button>
            </div>
            <div className="space-y-2">
              {connectors.map((connector) => (
                <button key={connector.uid} onClick={() => { connect({ connector }); setShowConnectModal(false); }}
                  className="w-full flex items-center justify-between p-3.5 bg-slate-900/80 hover:bg-slate-800 border border-white/10 rounded-xl text-xs font-semibold text-white transition-all group">
                  <span className="flex items-center space-x-2">
                    <span className="w-2 h-2 rounded-full bg-purple-400"></span>
                    <span>{connector.name}</span>
                  </span>
                  <span className="text-purple-400 text-[11px] group-hover:translate-x-0.5 transition-transform">Connect →</span>
                </button>
              ))}
              <div className="pt-2 border-t border-white/10">
                <p className="text-[11px] text-purple-300 font-semibold mb-2">⚡ Instant Demo Mode</p>
                <button onClick={() => { setSimulatedAddress('0xEB2166ec84F6273dF37cD7a5403494EeF641c113'); setShowConnectModal(false); }}
                  className="w-full flex items-center justify-between p-3.5 bg-gradient-to-r from-purple-900/40 to-indigo-900/40 hover:from-purple-800/60 hover:to-indigo-800/60 border border-purple-500/40 rounded-xl text-xs font-semibold text-purple-200 transition-all">
                  <div className="text-left">
                    <span className="block text-white">Demo Monad Wallet</span>
                    <span className="text-[10px] font-mono-custom text-purple-300">0xEB2166ec84F6273dF37cD7a5403494EeF641c113</span>
                  </div>
                  <span className="bg-purple-500 text-white text-[10px] px-2.5 py-1 rounded-full font-bold">1-Click</span>
                </button>
              </div>
            </div>
            <button onClick={() => setShowConnectModal(false)}
              className="w-full bg-slate-900 hover:bg-slate-800 text-slate-400 py-2 rounded-xl text-xs font-semibold transition-all">Cancel</button>
          </div>
        </div>
      )}

      {/* QR MODAL */}
      {showQrModal && currentAch && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel p-6 rounded-2xl border border-white/10 max-w-sm w-full text-center space-y-4">
            <h3 className="text-lg font-bold text-white">Achievement QR Code</h3>
            <div className="p-4 bg-white rounded-xl inline-block shadow-xl">
              <QRCodeSVG value={`https://proof-of-achievement.monad.xyz/verify?id=${currentAch.id.toString()}`} size={200} level="H" />
            </div>
            <p className="text-xs text-slate-400">Scan to verify Achievement #{currentAch.id.toString()}</p>
            <button onClick={() => setShowQrModal(false)} className="w-full bg-slate-800 hover:bg-slate-700 text-white py-2 rounded-xl text-xs font-semibold transition-all">Close</button>
          </div>
        </div>
      )}

      {/* TX RECEIPT MODAL */}
      {txReceipt && (
        <TxReceipt
          type={txReceipt.type}
          txHash={txReceipt.hash}
          rewardEth={txReceipt.rewardEth}
          onClose={() => setTxReceipt(null)}
        />
      )}

      {/* Footer */}
      <footer className="border-t border-white/10 py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-2">
          <span>Proof of Achievement © 2026 — Monad Buildathon MVP</span>
          <span className="font-mono-custom">Contract: {formatAddress(CONTRACT_ADDRESS)}</span>
        </div>
      </footer>
    </div>
  );
}
