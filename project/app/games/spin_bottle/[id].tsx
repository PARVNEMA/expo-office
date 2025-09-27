import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  Animated,
  Dimensions,
} from 'react-native';
import {
  RotateCcw,
  Users,
  ArrowLeft,
  Play,
  Target,
  RefreshCw,
  Crown,
} from 'lucide-react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';

import { useAuth } from '@/context/AuthContext';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

interface Player {
  id: string;
  name: string;
  position: number; // 0-7 positions around circle
  color: string;
}

interface SpinResult {
  spinner_id: string;
  spinner_name: string;
  target_id: string;
  target_name: string;
  spin_angle: number;
  timestamp: number;
}

interface GameState {
  status: 'waiting' | 'spinning' | 'result' | 'finished';
  players: Player[];
  current_spinner?: Player;
  spin_history: SpinResult[];
  round: number;
}

const { width } = Dimensions.get('window');
const CIRCLE_SIZE = Math.min(width - 80, 300);
const BOTTLE_SIZE = CIRCLE_SIZE * 0.6;

const playerColors = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444',
  '#8B5CF6', '#06B6D4', '#84CC16', '#F97316'
];

export default function SpinBottleGameScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  
  const [gameState, setGameState] = useState<GameState>({
    status: 'waiting',
    players: [
      { id: user?.id || '1', name: user?.full_name || 'You', position: 0, color: playerColors[0] },
      { id: '2', name: 'Alice', position: 1, color: playerColors[1] },
      { id: '3', name: 'Bob', position: 2, color: playerColors[2] },
      { id: '4', name: 'Charlie', position: 3, color: playerColors[3] },
      { id: '5', name: 'Diana', position: 4, color: playerColors[4] },
      { id: '6', name: 'Eve', position: 5, color: playerColors[5] },
    ],
    spin_history: [],
    round: 1,
  });

  const [loading, setLoading] = useState(false);
  const [selectedTarget, setSelectedTarget] = useState<Player | null>(null);
  
  const spinAnimation = useRef(new Animated.Value(0)).current;
  const bottleRotation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Set initial current spinner to first player
    if (!gameState.current_spinner && gameState.players.length > 0) {
      setGameState(prev => ({
        ...prev,
        current_spinner: prev.players[0],
      }));
    }
  }, []);

  const getPlayerPosition = (position: number, total: number) => {
    const angle = (position / total) * 2 * Math.PI - Math.PI / 2; // Start from top
    const radius = CIRCLE_SIZE / 2 - 40;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    return { x, y, angle: angle * (180 / Math.PI) + 90 };
  };

  const spin = () => {
    if (gameState.status === 'spinning') return;
    
    setGameState(prev => ({ ...prev, status: 'spinning' }));
    
    // Generate random spin (multiple rotations + final position)
    const baseRotation = spinAnimation._value || 0;
    const spins = Math.floor(Math.random() * 3 + 3); // 3-5 full rotations
    const finalAngle = Math.random() * 360;
    const totalRotation = baseRotation + (spins * 360) + finalAngle;
    
    // Calculate which player the bottle will point to
    const normalizedAngle = (finalAngle + 90) % 360; // Adjust for starting position
    const playerIndex = Math.floor((normalizedAngle / 360) * gameState.players.length);
    const targetPlayer = gameState.players[playerIndex];
    
    Animated.timing(spinAnimation, {
      toValue: totalRotation,
      duration: 3000 + Math.random() * 2000, // 3-5 seconds
      useNativeDriver: true,
    }).start(() => {
      // Show result
      setSelectedTarget(targetPlayer);
      
      const spinResult: SpinResult = {
        spinner_id: gameState.current_spinner?.id || '',
        spinner_name: gameState.current_spinner?.name || '',
        target_id: targetPlayer.id,
        target_name: targetPlayer.name,
        spin_angle: finalAngle,
        timestamp: Date.now(),
      };
      
      setTimeout(() => {
        setGameState(prev => ({
          ...prev,
          status: 'result',
          spin_history: [spinResult, ...prev.spin_history],
        }));
      }, 500);
    });
  };

  const nextSpinner = () => {
    const currentIndex = gameState.players.findIndex(p => p.id === gameState.current_spinner?.id);
    const nextIndex = (currentIndex + 1) % gameState.players.length;
    const nextPlayer = gameState.players[nextIndex];
    
    setSelectedTarget(null);
    setGameState(prev => ({
      ...prev,
      status: 'waiting',
      current_spinner: nextPlayer,
      round: currentIndex === gameState.players.length - 1 ? prev.round + 1 : prev.round,
    }));
  };

  const resetGame = () => {
    spinAnimation.setValue(0);
    setSelectedTarget(null);
    setGameState(prev => ({
      ...prev,
      status: 'waiting',
      current_spinner: prev.players[0],
      spin_history: [],
      round: 1,
    }));
  };

  if (loading) {
    return <LoadingSpinner fullScreen />;
  }

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-white px-4 py-4 border-b border-gray-200">
        <View className="flex-row items-center justify-between">
          <TouchableOpacity
            onPress={() => router.back()}
            className="flex-row items-center"
          >
            <ArrowLeft size={24} color="#374151" />
            <Text className="text-lg font-semibold text-gray-900 ml-2">
              Spin the Bottle
            </Text>
          </TouchableOpacity>
          
          <View className="flex-row items-center">
            <Text className="text-sm text-gray-600 mr-2">Round</Text>
            <View className="bg-blue-100 px-2 py-1 rounded">
              <Text className="text-blue-800 font-medium">{gameState.round}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Game Status */}
      <Card variant="elevated" className="m-4">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center">
            <Users size={20} color="#6B7280" />
            <Text className="text-gray-600 ml-2">
              {gameState.players.length} Players
            </Text>
          </View>
          
          <View className={`px-3 py-1 rounded-full ${
            gameState.status === 'spinning' 
              ? 'bg-yellow-100' 
              : gameState.status === 'result'
              ? 'bg-green-100'
              : 'bg-blue-100'
          }`}>
            <Text className={`text-sm font-medium ${
              gameState.status === 'spinning'
                ? 'text-yellow-800'
                : gameState.status === 'result'
                ? 'text-green-800'
                : 'text-blue-800'
            }`}>
              {gameState.status === 'spinning' ? 'Spinning...' : 
               gameState.status === 'result' ? 'Result!' : 'Waiting'}
            </Text>
          </View>
        </View>
        
        {gameState.current_spinner && (
          <View className="mt-3 flex-row items-center">
            <Text className="text-gray-600">Current spinner: </Text>
            <Text className="font-semibold text-gray-900">
              {gameState.current_spinner.name}
            </Text>
          </View>
        )}
      </Card>

      {/* Game Circle */}
      <View className="flex-1 items-center justify-center px-4">
        <View 
          className="relative items-center justify-center"
          style={{ width: CIRCLE_SIZE, height: CIRCLE_SIZE }}
        >
          {/* Circle Background */}
          <View 
            className="absolute border-4 border-gray-300 rounded-full bg-white"
            style={{ 
              width: CIRCLE_SIZE, 
              height: CIRCLE_SIZE,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.1,
              shadowRadius: 8,
            }}
          />
          
          {/* Players around circle */}
          {gameState.players.map((player, index) => {
            const position = getPlayerPosition(index, gameState.players.length);
            const isSpinner = player.id === gameState.current_spinner?.id;
            const isTarget = player.id === selectedTarget?.id;
            
            return (
              <View
                key={player.id}
                className="absolute items-center"
                style={{
                  transform: [
                    { translateX: position.x },
                    { translateY: position.y }
                  ]
                }}
              >
                <View
                  className={`w-12 h-12 rounded-full items-center justify-center border-3 ${
                    isSpinner ? 'border-yellow-400' : 
                    isTarget ? 'border-red-500' : 'border-gray-200'
                  }`}
                  style={{ 
                    backgroundColor: player.color + '20',
                    borderWidth: isSpinner || isTarget ? 3 : 2,
                  }}
                >
                  {isSpinner && <Crown size={16} color="#F59E0B" />}
                  {isTarget && <Target size={16} color="#EF4444" />}
                  {!isSpinner && !isTarget && (
                    <Text className="text-xs font-bold text-gray-700">
                      {player.name.charAt(0)}
                    </Text>
                  )}
                </View>
                
                <Text 
                  className={`text-xs font-medium mt-1 text-center ${
                    isSpinner ? 'text-yellow-800' : 
                    isTarget ? 'text-red-800' : 'text-gray-700'
                  }`}
                  style={{ maxWidth: 60 }}
                  numberOfLines={1}
                >
                  {player.name}
                </Text>
              </View>
            );
          })}
          
          {/* Bottle in center */}
          <Animated.View
            className="absolute items-center justify-center"
            style={{
              transform: [
                {
                  rotate: spinAnimation.interpolate({
                    inputRange: [0, 360],
                    outputRange: ['0deg', '360deg'],
                  }),
                },
              ],
            }}
          >
            <View
              className="bg-amber-800 rounded-full shadow-lg"
              style={{
                width: BOTTLE_SIZE * 0.2,
                height: BOTTLE_SIZE,
                borderRadius: BOTTLE_SIZE * 0.1,
              }}
            >
              {/* Bottle neck */}
              <View 
                className="bg-amber-700 rounded-full mx-auto"
                style={{
                  width: BOTTLE_SIZE * 0.1,
                  height: BOTTLE_SIZE * 0.3,
                  marginTop: -BOTTLE_SIZE * 0.05,
                  borderRadius: BOTTLE_SIZE * 0.05,
                }}
              />
              
              {/* Bottle tip (pointer) */}
              <View
                className="bg-amber-900 rounded-full mx-auto"
                style={{
                  width: 6,
                  height: 12,
                  marginTop: -6,
                  borderRadius: 3,
                }}
              />
            </View>
          </Animated.View>
        </View>
      </View>

      {/* Result Display */}
      {gameState.status === 'result' && selectedTarget && (
        <Card variant="elevated" className="mx-4 mb-4">
          <View className="items-center py-4">
            <Target size={48} color="#10B981" />
            <Text className="text-xl font-bold text-gray-900 mt-3 mb-1">
              Bottle points to...
            </Text>
            <Text className="text-2xl font-bold text-green-600 mb-2">
              {selectedTarget.name}!
            </Text>
            <Text className="text-gray-600 text-center">
              Spun by {gameState.current_spinner?.name}
            </Text>
          </View>
        </Card>
      )}

      {/* Spin History */}
      {gameState.spin_history.length > 0 && (
        <Card variant="elevated" className="mx-4 mb-4">
          <Text className="text-lg font-semibold text-gray-900 mb-3">
            Recent Spins
          </Text>
          
          {gameState.spin_history.slice(0, 3).map((spin, index) => (
            <View key={spin.timestamp} className="flex-row items-center justify-between py-2">
              <View className="flex-row items-center flex-1">
                <View className={`w-6 h-6 rounded-full items-center justify-center mr-3 ${
                  index === 0 ? 'bg-green-400' : 'bg-gray-300'
                }`}>
                  <Text className={`text-xs font-bold ${
                    index === 0 ? 'text-white' : 'text-gray-600'
                  }`}>
                    {index + 1}
                  </Text>
                </View>
                
                <View className="flex-1">
                  <Text className="font-medium text-gray-900">
                    {spin.spinner_name} → {spin.target_name}
                  </Text>
                  <Text className="text-sm text-gray-600">
                    {new Date(spin.timestamp).toLocaleTimeString()}
                  </Text>
                </View>
              </View>
              
              <RotateCcw size={16} color="#6B7280" />
            </View>
          ))}
        </Card>
      )}

      {/* Control Buttons */}
      <View className="flex-row mx-4 mb-4 space-x-3">
        {gameState.status === 'waiting' ? (
          <Button
            title="Spin the Bottle"
            onPress={spin}
            variant="primary"
            className="flex-1"
            leftIcon={<RotateCcw size={18} color="#FFFFFF" />}
          />
        ) : gameState.status === 'result' ? (
          <>
            <Button
              title="Reset Game"
              onPress={resetGame}
              variant="outline"
              className="flex-1"
              leftIcon={<RefreshCw size={18} color="#374151" />}
            />
            
            <Button
              title="Next Player"
              onPress={nextSpinner}
              variant="primary"
              className="flex-1"
              leftIcon={<Play size={18} color="#FFFFFF" />}
            />
          </>
        ) : (
          <View className="flex-1 items-center">
            <Text className="text-gray-600 font-medium">
              Spinning...
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}