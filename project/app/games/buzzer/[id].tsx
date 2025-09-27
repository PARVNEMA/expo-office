import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  Animated,
  Vibration,
} from 'react-native';
import {
  Zap,
  Users,
  Crown,
  Clock,
  ArrowLeft,
  RotateCcw,
  Play,
} from 'lucide-react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';

import { useAuth } from '@/context/AuthContext';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

interface BuzzerPress {
  id: string;
  user_id: string;
  user_name: string;
  timestamp: number;
  order: number;
}

interface GameState {
  status: 'waiting' | 'active' | 'finished' | 'results';
  round: number;
  winner?: BuzzerPress;
  presses: BuzzerPress[];
  participants: { id: string; name: string; score: number }[];
}

export default function BuzzerGameScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  
  const [gameState, setGameState] = useState<GameState>({
    status: 'waiting',
    round: 1,
    presses: [],
    participants: [
      { id: user?.id || '1', name: user?.full_name || 'You', score: 0 },
      { id: '2', name: 'Alice', score: 0 },
      { id: '3', name: 'Bob', score: 0 },
      { id: '4', name: 'Charlie', score: 0 },
    ],
  });

  const [loading, setLoading] = useState(false);
  const [hasPressed, setHasPressed] = useState(false);
  const [countdown, setCountdown] = useState(0);
  
  const buzzerAnimation = useRef(new Animated.Value(1)).current;
  const pulseAnimation = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Start pulsing animation when game is active
    if (gameState.status === 'active') {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnimation, {
            toValue: 1.1,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnimation, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      
      return () => pulse.stop();
    }
  }, [gameState.status]);

  const startGame = () => {
    setHasPressed(false);
    setGameState(prev => ({ 
      ...prev, 
      status: 'waiting',
      presses: [],
      winner: undefined,
    }));
    
    // Countdown
    let count = 3;
    setCountdown(count);
    
    const countdownInterval = setInterval(() => {
      count--;
      setCountdown(count);
      
      if (count === 0) {
        clearInterval(countdownInterval);
        // Random delay between 1-5 seconds
        const randomDelay = Math.random() * 4000 + 1000;
        
        setTimeout(() => {
          setGameState(prev => ({ ...prev, status: 'active' }));
          setCountdown(0);
        }, randomDelay);
      }
    }, 1000);
  };

  const handleBuzzerPress = () => {
    if (gameState.status !== 'active' || hasPressed) return;
    
    setHasPressed(true);
    Vibration.vibrate(100);
    
    // Animate buzzer press
    Animated.sequence([
      Animated.timing(buzzerAnimation, {
        toValue: 0.9,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(buzzerAnimation, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();

    const newPress: BuzzerPress = {
      id: Math.random().toString(),
      user_id: user?.id || '1',
      user_name: user?.full_name || 'You',
      timestamp: Date.now(),
      order: gameState.presses.length + 1,
    };

    // Simulate other players pressing (for demo)
    const simulatedPresses: BuzzerPress[] = [];
    const otherPlayers = gameState.participants.filter(p => p.id !== user?.id);
    
    otherPlayers.forEach((player, index) => {
      if (Math.random() > 0.3) { // 70% chance they'll press
        simulatedPresses.push({
          id: Math.random().toString(),
          user_id: player.id,
          user_name: player.name,
          timestamp: Date.now() + Math.random() * 2000 + (index * 100),
          order: gameState.presses.length + simulatedPresses.length + 2,
        });
      }
    });

    const allPresses = [newPress, ...simulatedPresses].sort((a, b) => a.timestamp - b.timestamp);
    
    // Update order based on sorted timestamps
    allPresses.forEach((press, index) => {
      press.order = index + 1;
    });

    const winner = allPresses[0];
    
    setTimeout(() => {
      setGameState(prev => ({
        ...prev,
        status: 'results',
        presses: allPresses,
        winner,
        participants: prev.participants.map(p => 
          p.id === winner.user_id 
            ? { ...p, score: p.score + 1 }
            : p
        ),
      }));
    }, 2000);
  };

  const resetGame = () => {
    setGameState(prev => ({
      ...prev,
      status: 'waiting',
      presses: [],
      winner: undefined,
    }));
    setHasPressed(false);
  };

  const getBuzzerColor = () => {
    switch (gameState.status) {
      case 'waiting':
        return '#6B7280';
      case 'active':
        return '#F59E0B';
      case 'results':
        return gameState.winner?.user_id === user?.id ? '#10B981' : '#EF4444';
      default:
        return '#6B7280';
    }
  };

  const getBuzzerText = () => {
    switch (gameState.status) {
      case 'waiting':
        return countdown > 0 ? countdown.toString() : 'Get Ready...';
      case 'active':
        return 'PRESS!';
      case 'results':
        return gameState.winner?.user_id === user?.id ? 'You Won!' : 'Too Late!';
      default:
        return 'Buzzer';
    }
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
              Buzzer Game
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
              {gameState.participants.length} Players
            </Text>
          </View>
          
          <View className={`px-3 py-1 rounded-full ${
            gameState.status === 'active' 
              ? 'bg-green-100' 
              : gameState.status === 'waiting'
              ? 'bg-yellow-100'
              : 'bg-blue-100'
          }`}>
            <Text className={`text-sm font-medium ${
              gameState.status === 'active'
                ? 'text-green-800'
                : gameState.status === 'waiting'
                ? 'text-yellow-800'
                : 'text-blue-800'
            }`}>
              {gameState.status === 'active' ? 'Active' : 
               gameState.status === 'waiting' ? 'Waiting' : 'Results'}
            </Text>
          </View>
        </View>
      </Card>

      {/* Buzzer */}
      <View className="flex-1 items-center justify-center px-4">
        <Animated.View
          style={{
            transform: [
              { scale: buzzerAnimation },
              { scale: gameState.status === 'active' ? pulseAnimation : 1 },
            ],
          }}
        >
          <TouchableOpacity
            onPress={handleBuzzerPress}
            disabled={gameState.status !== 'active' || hasPressed}
            className="relative items-center justify-center"
            activeOpacity={0.8}
          >
            <View
              className="w-64 h-64 rounded-full items-center justify-center shadow-2xl"
              style={{ 
                backgroundColor: getBuzzerColor(),
                shadowColor: getBuzzerColor(),
                shadowOpacity: 0.3,
                shadowRadius: 20,
                shadowOffset: { width: 0, height: 10 },
              }}
            >
              <Zap size={64} color="#FFFFFF" />
              <Text className="text-white text-2xl font-bold mt-4">
                {getBuzzerText()}
              </Text>
            </View>
            
            {gameState.status === 'active' && (
              <View className="absolute -inset-8 rounded-full border-4 border-yellow-400 opacity-60" />
            )}
          </TouchableOpacity>
        </Animated.View>
      </View>

      {/* Results */}
      {gameState.status === 'results' && (
        <Card variant="elevated" className="m-4">
          <Text className="text-lg font-semibold text-gray-900 mb-4">
            Round Results
          </Text>
          
          {gameState.presses.map((press, index) => (
            <View key={press.id} className="flex-row items-center justify-between py-2">
              <View className="flex-row items-center">
                <View className={`w-6 h-6 rounded-full items-center justify-center mr-3 ${
                  index === 0 ? 'bg-yellow-400' : 'bg-gray-300'
                }`}>
                  {index === 0 ? (
                    <Crown size={12} color="#FFFFFF" />
                  ) : (
                    <Text className="text-xs font-bold text-gray-600">
                      {press.order}
                    </Text>
                  )}
                </View>
                <Text className="font-medium text-gray-900">{press.user_name}</Text>
              </View>
              
              <View className="flex-row items-center">
                <Clock size={14} color="#6B7280" />
                <Text className="text-sm text-gray-600 ml-1">
                  {((press.timestamp - gameState.presses[0]?.timestamp) / 1000).toFixed(2)}s
                </Text>
              </View>
            </View>
          ))}
        </Card>
      )}

      {/* Leaderboard */}
      <Card variant="elevated" className="mx-4 mb-4">
        <Text className="text-lg font-semibold text-gray-900 mb-4">
          Leaderboard
        </Text>
        
        {gameState.participants
          .sort((a, b) => b.score - a.score)
          .map((participant, index) => (
            <View key={participant.id} className="flex-row items-center justify-between py-2">
              <View className="flex-row items-center">
                <View className={`w-6 h-6 rounded-full items-center justify-center mr-3 ${
                  index === 0 ? 'bg-yellow-400' : 'bg-gray-300'
                }`}>
                  <Text className={`text-xs font-bold ${
                    index === 0 ? 'text-white' : 'text-gray-600'
                  }`}>
                    {index + 1}
                  </Text>
                </View>
                <Text className="font-medium text-gray-900">
                  {participant.name}
                </Text>
              </View>
              
              <Text className="text-lg font-bold text-blue-600">
                {participant.score}
              </Text>
            </View>
          ))}
      </Card>

      {/* Control Buttons */}
      <View className="flex-row mx-4 mb-4 space-x-3">
        {gameState.status === 'waiting' && gameState.presses.length === 0 ? (
          <Button
            title="Start Round"
            onPress={startGame}
            variant="primary"
            className="flex-1"
            leftIcon={<Play size={18} color="#FFFFFF" />}
          />
        ) : (
          <>
            <Button
              title="New Round"
              onPress={resetGame}
              variant="outline"
              className="flex-1"
              leftIcon={<RotateCcw size={18} color="#374151" />}
            />
            
            <Button
              title="Start Round"
              onPress={startGame}
              variant="primary"
              className="flex-1"
              leftIcon={<Play size={18} color="#FFFFFF" />}
              disabled={gameState.status === 'active' || countdown > 0}
            />
          </>
        )}
      </View>
    </View>
  );
}