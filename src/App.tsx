import { Suspense, useState, useEffect, useRef, useCallback } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Stars, Float, Text, MeshDistortMaterial, Sphere, Environment, Html } from '@react-three/drei'
import * as THREE from 'three'
import { ethers } from 'ethers'

// Contract ABI (simplified for the main functions we need)
const CONTRACT_ABI = [
  "function createProfile(uint8 elementChoice) external",
  "function getDailyFortune() external",
  "function startMatch(address opponent) external",
  "function getProfile(address user) external view returns (uint8 element, uint256 luckyNumber, uint256 xp, uint256 level, uint256 energy, uint256 winStreak, uint256 lastFortuneTime)",
  "function getMatchResult(address player1, address player2) external view returns (address winner, uint256 player1Roll, uint256 player2Roll, uint256 timestamp)",
  "event ProfileCreated(address indexed user, uint8 element, uint256 luckyNumber)",
  "event FortuneReceived(address indexed user, uint256 fortuneBonus, uint256 newXP)",
  "event MatchResult(address indexed player1, address indexed player2, address winner, uint256 player1Roll, uint256 player2Roll)"
]

const CONTRACT_ADDRESS = "0xA6E3778829b73A961B12900b1aE6821FD84997d0"
const BASE_CHAIN_ID = 8453

// Element data
const ELEMENTS = {
  0: { name: 'Fire', color: '#FF6B35', emoji: '🔥', gradient: 'from-orange-500 to-red-600' },
  1: { name: 'Water', color: '#00B4D8', emoji: '💧', gradient: 'from-cyan-400 to-blue-600' },
  2: { name: 'Air', color: '#E0E0E0', emoji: '💨', gradient: 'from-gray-300 to-slate-400' },
  3: { name: 'Earth', color: '#8B5A2B', emoji: '🌍', gradient: 'from-amber-700 to-emerald-800' }
}

// Cosmic floating orbs for each element
function ElementOrb({ element, position, scale = 1 }: { element: number; position: [number, number, number]; scale?: number }) {
  const meshRef = useRef<THREE.Mesh>(null!)
  const color = ELEMENTS[element as keyof typeof ELEMENTS]?.color || '#ffffff'

  useFrame((state) => {
    meshRef.current.rotation.y = state.clock.elapsedTime * 0.3
    meshRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.2) * 0.2
  })

  return (
    <Float speed={2} rotationIntensity={0.5} floatIntensity={1}>
      <mesh ref={meshRef} position={position} scale={scale}>
        <icosahedronGeometry args={[1, 1]} />
        <MeshDistortMaterial
          color={color}
          attach="material"
          distort={0.4}
          speed={2}
          roughness={0.2}
          metalness={0.8}
        />
      </mesh>
    </Float>
  )
}

// Constellation particles
function ConstellationParticles() {
  const particlesRef = useRef<THREE.Points>(null!)
  const count = 200

  const positions = new Float32Array(count * 3)
  for (let i = 0; i < count * 3; i += 3) {
    positions[i] = (Math.random() - 0.5) * 30
    positions[i + 1] = (Math.random() - 0.5) * 30
    positions[i + 2] = (Math.random() - 0.5) * 30
  }

  useFrame((state) => {
    if (particlesRef.current) {
      particlesRef.current.rotation.y = state.clock.elapsedTime * 0.02
    }
  })

  return (
    <points ref={particlesRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial size={0.08} color="#ffd700" transparent opacity={0.8} sizeAttenuation />
    </points>
  )
}

// Zodiac ring
function ZodiacRing() {
  const ringRef = useRef<THREE.Group>(null!)

  useFrame((state) => {
    if (ringRef.current) {
      ringRef.current.rotation.z = state.clock.elapsedTime * 0.05
    }
  })

  const symbols = ['♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓']

  return (
    <group ref={ringRef}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[8, 0.05, 16, 100]} />
        <meshStandardMaterial color="#ffd700" metalness={0.9} roughness={0.1} />
      </mesh>
      {symbols.map((symbol, i) => {
        const angle = (i / 12) * Math.PI * 2
        const x = Math.cos(angle) * 8
        const z = Math.sin(angle) * 8
        return (
          <Text
            key={i}
            position={[x, 0, z]}
            rotation={[0, -angle + Math.PI / 2, 0]}
            fontSize={0.5}
            color="#ffd700"
            anchorX="center"
            anchorY="middle"
          >
            {symbol}
          </Text>
        )
      })}
    </group>
  )
}

// Central crystal
function CentralCrystal({ userElement }: { userElement: number | null }) {
  const meshRef = useRef<THREE.Mesh>(null!)
  const color = userElement !== null ? ELEMENTS[userElement as keyof typeof ELEMENTS]?.color : '#9333ea'

  useFrame((state) => {
    meshRef.current.rotation.y = state.clock.elapsedTime * 0.5
    meshRef.current.position.y = Math.sin(state.clock.elapsedTime) * 0.3
  })

  return (
    <Float speed={1.5} rotationIntensity={0.3} floatIntensity={0.5}>
      <mesh ref={meshRef}>
        <octahedronGeometry args={[1.5, 0]} />
        <meshStandardMaterial
          color={color}
          metalness={0.9}
          roughness={0.1}
          emissive={color}
          emissiveIntensity={0.3}
        />
      </mesh>
      {/* Glow sphere */}
      <Sphere args={[2, 32, 32]}>
        <meshBasicMaterial color={color} transparent opacity={0.1} />
      </Sphere>
    </Float>
  )
}

// 3D Scene
function Scene3D({ userElement }: { userElement: number | null }) {
  return (
    <>
      <ambientLight intensity={0.3} />
      <pointLight position={[10, 10, 10]} intensity={1} color="#ffd700" />
      <pointLight position={[-10, -10, -10]} intensity={0.5} color="#9333ea" />
      <spotLight position={[0, 10, 0]} intensity={0.8} color="#ffffff" angle={0.3} penumbra={0.5} />

      <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
      <ConstellationParticles />
      <ZodiacRing />
      <CentralCrystal userElement={userElement} />

      {/* Element orbs */}
      <ElementOrb element={0} position={[-4, 2, -2]} scale={0.6} />
      <ElementOrb element={1} position={[4, -1, -3]} scale={0.5} />
      <ElementOrb element={2} position={[-3, -2, 2]} scale={0.4} />
      <ElementOrb element={3} position={[3, 1, 3]} scale={0.5} />

      <Environment preset="night" />
      <OrbitControls
        enableZoom={true}
        enablePan={false}
        minDistance={5}
        maxDistance={20}
        autoRotate
        autoRotateSpeed={0.5}
      />
    </>
  )
}

// Profile interface
interface UserProfile {
  element: number
  luckyNumber: number
  xp: number
  level: number
  energy: number
  winStreak: number
  lastFortuneTime: number
  hasProfile: boolean
}

// Match result interface
interface MatchResult {
  winner: string
  player1Roll: number
  player2Roll: number
  timestamp: number
}

function App() {
  const [account, setAccount] = useState<string | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(false)
  const [txStatus, setTxStatus] = useState<string>('')
  const [opponentAddress, setOpponentAddress] = useState('')
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null)
  const [showElementPicker, setShowElementPicker] = useState(false)
  const [chainId, setChainId] = useState<number | null>(null)

  // Connect wallet
  const connectWallet = useCallback(async () => {
    if (typeof window.ethereum === 'undefined') {
      setTxStatus('Please install MetaMask!')
      return
    }

    try {
      setLoading(true)
      const provider = new ethers.BrowserProvider(window.ethereum)
      const accounts = await provider.send('eth_requestAccounts', [])
      const network = await provider.getNetwork()

      setChainId(Number(network.chainId))
      setAccount(accounts[0])

      if (Number(network.chainId) !== BASE_CHAIN_ID) {
        setTxStatus('Please switch to Base network')
        try {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0x2105' }],
          })
        } catch {
          // Try to add Base network
          try {
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [{
                chainId: '0x2105',
                chainName: 'Base',
                nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
                rpcUrls: ['https://mainnet.base.org'],
                blockExplorerUrls: ['https://basescan.org']
              }]
            })
          } catch {
            setTxStatus('Failed to switch to Base network')
          }
        }
      }
    } catch {
      setTxStatus('Failed to connect wallet')
    } finally {
      setLoading(false)
    }
  }, [])

  // Fetch profile
  const fetchProfile = useCallback(async () => {
    if (!account) return

    try {
      const provider = new ethers.BrowserProvider(window.ethereum)
      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider)

      const profileData = await contract.getProfile(account)

      // Check if profile exists (luckyNumber > 0 typically means profile exists)
      const hasProfile = Number(profileData[1]) > 0

      setProfile({
        element: Number(profileData[0]),
        luckyNumber: Number(profileData[1]),
        xp: Number(profileData[2]),
        level: Number(profileData[3]),
        energy: Number(profileData[4]),
        winStreak: Number(profileData[5]),
        lastFortuneTime: Number(profileData[6]),
        hasProfile
      })
    } catch (err) {
      console.error('Failed to fetch profile:', err)
      setProfile(null)
    }
  }, [account])

  // Create profile
  const createProfile = async (elementChoice: number) => {
    if (!account) return

    try {
      setLoading(true)
      setTxStatus('Creating your cosmic profile...')

      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer)

      const tx = await contract.createProfile(elementChoice)
      setTxStatus('Waiting for confirmation...')
      await tx.wait()

      setTxStatus('Profile created! ✨')
      setShowElementPicker(false)
      await fetchProfile()
    } catch (err: unknown) {
      const error = err as { reason?: string; message?: string }
      setTxStatus(error?.reason || error?.message || 'Failed to create profile')
    } finally {
      setLoading(false)
    }
  }

  // Get daily fortune
  const getDailyFortune = async () => {
    if (!account) return

    try {
      setLoading(true)
      setTxStatus('Consulting the stars...')

      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer)

      const tx = await contract.getDailyFortune()
      setTxStatus('Waiting for cosmic alignment...')
      await tx.wait()

      setTxStatus('Fortune received! 🌟')
      await fetchProfile()
    } catch (err: unknown) {
      const error = err as { reason?: string; message?: string }
      setTxStatus(error?.reason || error?.message || 'Failed to get fortune')
    } finally {
      setLoading(false)
    }
  }

  // Start match
  const startMatch = async () => {
    if (!account || !opponentAddress) return

    if (!ethers.isAddress(opponentAddress)) {
      setTxStatus('Invalid opponent address')
      return
    }

    try {
      setLoading(true)
      setTxStatus('Initiating cosmic battle...')

      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer)

      const tx = await contract.startMatch(opponentAddress)
      setTxStatus('The elements are clashing...')
      await tx.wait()

      // Fetch match result
      const result = await contract.getMatchResult(account, opponentAddress)
      setMatchResult({
        winner: result[0],
        player1Roll: Number(result[1]),
        player2Roll: Number(result[2]),
        timestamp: Number(result[3])
      })

      setTxStatus('Battle complete! ⚔️')
      await fetchProfile()
    } catch (err: unknown) {
      const error = err as { reason?: string; message?: string }
      setTxStatus(error?.reason || error?.message || 'Failed to start match')
    } finally {
      setLoading(false)
    }
  }

  // Check if fortune is available
  const canGetFortune = () => {
    if (!profile) return false
    const now = Math.floor(Date.now() / 1000)
    return now - profile.lastFortuneTime >= 86400 // 24 hours
  }

  // Time until next fortune
  const getTimeUntilFortune = () => {
    if (!profile) return ''
    const now = Math.floor(Date.now() / 1000)
    const timeSince = now - profile.lastFortuneTime
    const timeLeft = 86400 - timeSince
    if (timeLeft <= 0) return 'Available now!'
    const hours = Math.floor(timeLeft / 3600)
    const minutes = Math.floor((timeLeft % 3600) / 60)
    return `${hours}h ${minutes}m`
  }

  useEffect(() => {
    if (account && chainId === BASE_CHAIN_ID) {
      fetchProfile()
    }
  }, [account, chainId, fetchProfile])

  // Listen for account changes
  useEffect(() => {
    if (typeof window.ethereum !== 'undefined') {
      const handleAccountsChanged = (accounts: unknown) => {
        const accs = accounts as string[]
        setAccount(accs[0] || null)
        setProfile(null)
        setMatchResult(null)
      }
      const handleChainChanged = () => {
        window.location.reload()
      }
      window.ethereum.on('accountsChanged', handleAccountsChanged)
      window.ethereum.on('chainChanged', handleChainChanged)
    }
  }, [])

  const elementData = profile?.hasProfile ? ELEMENTS[profile.element as keyof typeof ELEMENTS] : null

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black">
      {/* 3D Canvas */}
      <Canvas camera={{ position: [0, 2, 12], fov: 60 }}>
        <Suspense fallback={null}>
          <Scene3D userElement={profile?.hasProfile ? profile.element : null} />
        </Suspense>
      </Canvas>

      {/* UI Overlay */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Header */}
        <header className="pointer-events-auto p-4 md:p-6 flex justify-between items-start">
          <div className="space-y-1">
            <h1 className="font-display text-2xl md:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-500 drop-shadow-lg tracking-wider">
              ASTRAL CLASH
            </h1>
            <p className="text-xs md:text-sm text-amber-200/60 font-body tracking-widest uppercase">
              On-Chain Astrology Social Game
            </p>
          </div>

          {/* Wallet Button */}
          <button
            onClick={connectWallet}
            disabled={loading}
            className="pointer-events-auto px-4 md:px-6 py-2 md:py-3 rounded-full font-body text-sm md:text-base font-medium transition-all duration-300 border-2 border-amber-400/50 bg-black/40 backdrop-blur-md text-amber-300 hover:bg-amber-400/20 hover:border-amber-300 hover:shadow-lg hover:shadow-amber-500/20 disabled:opacity-50"
          >
            {loading ? '...' : account ? `${account.slice(0, 6)}...${account.slice(-4)}` : 'Connect Wallet'}
          </button>
        </header>

        {/* Main Content */}
        <main className="absolute inset-0 flex items-center justify-center p-4">
          {!account ? (
            /* Connect Prompt */
            <div className="pointer-events-auto text-center space-y-6 max-w-md mx-auto bg-black/50 backdrop-blur-xl rounded-3xl p-6 md:p-10 border border-amber-500/30">
              <div className="text-6xl md:text-8xl animate-pulse">✨</div>
              <h2 className="font-display text-2xl md:text-3xl text-amber-300">Welcome, Cosmic Traveler</h2>
              <p className="text-amber-200/70 font-body text-sm md:text-base">
                Connect your wallet to discover your element, battle other players, and earn XP through daily fortunes.
              </p>
              <button
                onClick={connectWallet}
                className="px-8 py-4 rounded-full font-display text-lg font-bold bg-gradient-to-r from-amber-500 to-orange-600 text-black hover:from-amber-400 hover:to-orange-500 transition-all duration-300 shadow-lg shadow-amber-500/30 hover:shadow-amber-400/50 hover:scale-105"
              >
                Enter the Cosmos
              </button>
              <p className="text-amber-200/40 text-xs font-body">Base Network Required</p>
            </div>
          ) : chainId !== BASE_CHAIN_ID ? (
            /* Wrong Network */
            <div className="pointer-events-auto text-center space-y-6 max-w-md mx-auto bg-black/50 backdrop-blur-xl rounded-3xl p-6 md:p-10 border border-red-500/30">
              <div className="text-6xl">⚠️</div>
              <h2 className="font-display text-2xl text-red-400">Wrong Network</h2>
              <p className="text-red-200/70 font-body">Please switch to Base network to continue.</p>
            </div>
          ) : !profile?.hasProfile ? (
            /* Create Profile */
            showElementPicker ? (
              <div className="pointer-events-auto space-y-6 max-w-lg mx-auto bg-black/60 backdrop-blur-xl rounded-3xl p-6 md:p-10 border border-amber-500/30">
                <h2 className="font-display text-xl md:text-2xl text-center text-amber-300">Choose Your Element</h2>
                <div className="grid grid-cols-2 gap-4">
                  {Object.entries(ELEMENTS).map(([key, el]) => (
                    <button
                      key={key}
                      onClick={() => createProfile(Number(key))}
                      disabled={loading}
                      className={`p-4 md:p-6 rounded-2xl border-2 border-transparent bg-gradient-to-br ${el.gradient} hover:border-white/50 transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:hover:scale-100`}
                    >
                      <div className="text-3xl md:text-4xl mb-2">{el.emoji}</div>
                      <div className="font-display text-lg md:text-xl text-white">{el.name}</div>
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setShowElementPicker(false)}
                  className="w-full py-2 text-amber-300/60 hover:text-amber-300 font-body text-sm"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="pointer-events-auto text-center space-y-6 max-w-md mx-auto bg-black/50 backdrop-blur-xl rounded-3xl p-6 md:p-10 border border-amber-500/30">
                <div className="text-6xl md:text-8xl">🌌</div>
                <h2 className="font-display text-2xl md:text-3xl text-amber-300">Create Your Profile</h2>
                <p className="text-amber-200/70 font-body text-sm md:text-base">
                  Choose your cosmic element and receive your lucky number from the blockchain.
                </p>
                <button
                  onClick={() => setShowElementPicker(true)}
                  className="px-8 py-4 rounded-full font-display text-lg font-bold bg-gradient-to-r from-purple-500 to-indigo-600 text-white hover:from-purple-400 hover:to-indigo-500 transition-all duration-300 shadow-lg shadow-purple-500/30"
                >
                  Begin Journey
                </button>
              </div>
            )
          ) : (
            /* Profile Dashboard */
            <div className="pointer-events-auto w-full max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
              {/* Profile Card */}
              <div className="lg:col-span-1 bg-black/50 backdrop-blur-xl rounded-3xl p-4 md:p-6 border border-amber-500/30 space-y-4">
                <div className="text-center">
                  <div className="text-5xl md:text-6xl mb-2">{elementData?.emoji}</div>
                  <h3 className="font-display text-xl md:text-2xl text-amber-300">{elementData?.name} Mage</h3>
                  <p className="text-amber-200/50 font-body text-xs md:text-sm">Level {profile.level}</p>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 bg-white/5 rounded-xl">
                    <span className="text-amber-200/70 font-body text-sm">Lucky Number</span>
                    <span className="font-display text-xl text-amber-300">#{profile.luckyNumber}</span>
                  </div>

                  <div className="flex justify-between items-center p-3 bg-white/5 rounded-xl">
                    <span className="text-amber-200/70 font-body text-sm">XP</span>
                    <span className="font-display text-lg text-green-400">{profile.xp}</span>
                  </div>

                  <div className="flex justify-between items-center p-3 bg-white/5 rounded-xl">
                    <span className="text-amber-200/70 font-body text-sm">Energy</span>
                    <span className="font-display text-lg text-cyan-400">⚡ {profile.energy}</span>
                  </div>

                  <div className="flex justify-between items-center p-3 bg-white/5 rounded-xl">
                    <span className="text-amber-200/70 font-body text-sm">Win Streak</span>
                    <span className="font-display text-lg text-orange-400">🔥 {profile.winStreak}</span>
                  </div>
                </div>
              </div>

              {/* Actions Panel */}
              <div className="lg:col-span-2 space-y-4 md:space-y-6">
                {/* Daily Fortune */}
                <div className="bg-black/50 backdrop-blur-xl rounded-3xl p-4 md:p-6 border border-purple-500/30">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <h3 className="font-display text-lg md:text-xl text-purple-300">Daily Fortune</h3>
                      <p className="text-purple-200/50 font-body text-xs md:text-sm">
                        {canGetFortune() ? 'Your fortune awaits!' : `Next fortune: ${getTimeUntilFortune()}`}
                      </p>
                    </div>
                    <button
                      onClick={getDailyFortune}
                      disabled={loading || !canGetFortune()}
                      className="px-6 py-3 rounded-full font-display text-base font-bold bg-gradient-to-r from-purple-500 to-pink-600 text-white hover:from-purple-400 hover:to-pink-500 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-purple-500/20"
                    >
                      {loading ? '...' : '🔮 Claim Fortune'}
                    </button>
                  </div>
                </div>

                {/* PvP Match */}
                <div className="bg-black/50 backdrop-blur-xl rounded-3xl p-4 md:p-6 border border-red-500/30">
                  <h3 className="font-display text-lg md:text-xl text-red-300 mb-4">⚔️ Element Battle</h3>
                  <div className="flex flex-col md:flex-row gap-3">
                    <input
                      type="text"
                      placeholder="Opponent address (0x...)"
                      value={opponentAddress}
                      onChange={(e) => setOpponentAddress(e.target.value)}
                      className="flex-1 px-4 py-3 rounded-xl bg-white/10 border border-red-500/30 text-white placeholder-red-200/30 font-body text-sm focus:outline-none focus:border-red-400"
                    />
                    <button
                      onClick={startMatch}
                      disabled={loading || !opponentAddress}
                      className="px-6 py-3 rounded-full font-display text-base font-bold bg-gradient-to-r from-red-500 to-orange-600 text-white hover:from-red-400 hover:to-orange-500 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-red-500/20"
                    >
                      {loading ? '...' : 'Battle!'}
                    </button>
                  </div>

                  {/* Match Result */}
                  {matchResult && matchResult.timestamp > 0 && (
                    <div className="mt-4 p-4 bg-white/5 rounded-xl border border-amber-500/30">
                      <div className="text-center space-y-2">
                        <p className="font-display text-lg text-amber-300">
                          {matchResult.winner.toLowerCase() === account?.toLowerCase() ? '🏆 Victory!' : '💀 Defeat'}
                        </p>
                        <div className="flex justify-center gap-6 text-sm font-body">
                          <span className="text-amber-200/70">Your Roll: <strong className="text-white">{matchResult.player1Roll}</strong></span>
                          <span className="text-amber-200/70">Enemy Roll: <strong className="text-white">{matchResult.player2Roll}</strong></span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Status */}
                {txStatus && (
                  <div className="text-center p-3 bg-white/5 rounded-xl">
                    <p className="font-body text-sm text-amber-200/70">{txStatus}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </main>

        {/* Footer */}
        <footer className="absolute bottom-0 left-0 right-0 p-4 text-center pointer-events-none">
          <p className="text-amber-200/30 text-xs font-body">
            Requested by @jianke2 · Built by @clonkbot
          </p>
        </footer>
      </div>

      {/* Global Styles */}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }

        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 20px rgba(251, 191, 36, 0.3); }
          50% { box-shadow: 0 0 40px rgba(251, 191, 36, 0.5); }
        }

        .font-display {
          font-family: 'Cinzel', serif;
        }

        .font-body {
          font-family: 'Cormorant Garamond', serif;
        }

        /* Custom scrollbar */
        ::-webkit-scrollbar {
          width: 8px;
        }

        ::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.3);
        }

        ::-webkit-scrollbar-thumb {
          background: rgba(251, 191, 36, 0.3);
          border-radius: 4px;
        }

        ::-webkit-scrollbar-thumb:hover {
          background: rgba(251, 191, 36, 0.5);
        }
      `}</style>
    </div>
  )
}

// TypeScript declarations for window.ethereum
declare global {
  interface Window {
    ethereum: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>
      on: (event: string, handler: (...args: unknown[]) => void) => void
      removeListener: (event: string, handler: (...args: unknown[]) => void) => void
    }
  }
}

export default App
