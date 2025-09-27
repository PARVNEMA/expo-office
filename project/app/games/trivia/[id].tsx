import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  Animated,
  ScrollView,
} from 'react-native';
import {
  Brain,
  Users,
  Clock,
  ArrowLeft,
  CheckCircle,
  XCircle,
  Trophy,
  Star,
} from 'lucide-react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';

import { useAuth } from '@/context/AuthContext';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

interface Question {
  id: string;
  question: string;
  options: string[];
  correct_answer: number;
  difficulty: 'easy' | 'medium' | 'hard';
  category: string;
}

interface PlayerAnswer {
  user_id: string;
  user_name: string;
  answer: number;
  time_taken: number;
  is_correct: boolean;
}

interface GameState {
  status: 'waiting' | 'question' | 'results' | 'finished';
  current_question: number;
  total_questions: number;
  time_left: number;
  participants: { id: string; name: string; score: number; correct_answers: number }[];
  current_answers: PlayerAnswer[];
}

const sampleQuestions: Question[] = [
  {
    id: '1',
    question: 'What is the capital of France?',
    options: ['London', 'Berlin', 'Paris', 'Madrid'],
    correct_answer: 2,
    difficulty: 'easy',
    category: 'Geography',
  },
  {
    id: '2',
    question: 'Which planet is known as the Red Planet?',
    options: ['Venus', 'Mars', 'Jupiter', 'Saturn'],
    correct_answer: 1,
    difficulty: 'easy',
    category: 'Science',
  },
  {
    id: '3',
    question: 'Who painted the Mona Lisa?',
    options: ['Vincent van Gogh', 'Pablo Picasso', 'Leonardo da Vinci', 'Michelangelo'],
    correct_answer: 2,
    difficulty: 'medium',
    category: 'Art',
  },
  {
    id: '4',
    question: 'What is the largest mammal in the world?',
    options: ['African Elephant', 'Blue Whale', 'Giraffe', 'Polar Bear'],
    correct_answer: 1,
    difficulty: 'easy',
    category: 'Nature',
  },
  {
    id: '5',
    question: 'In which year did the Berlin Wall fall?',
    options: ['1987', '1988', '1989', '1990'],
    correct_answer: 2,
    difficulty: 'hard',
    category: 'History',
  },
];

export default function TriviaGameScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  
  const [gameState, setGameState] = useState<GameState>({
    status: 'waiting',
    current_question: 0,
    total_questions: sampleQuestions.length,
    time_left: 30,
    participants: [
      { id: user?.id || '1', name: user?.full_name || 'You', score: 0, correct_answers: 0 },
      { id: '2', name: 'Alice', score: 0, correct_answers: 0 },
      { id: '3', name: 'Bob', score: 0, correct_answers: 0 },
      { id: '4', name: 'Charlie', score: 0, correct_answers: 0 },
    ],
    current_answers: [],
  });

  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showCorrectAnswer, setShowCorrectAnswer] = useState(false);
  
  const timerRef = useRef<NodeJS.Timeout>();
  const progressAnimation = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (gameState.status === 'question' && gameState.time_left > 0) {
      // Start progress animation
      Animated.timing(progressAnimation, {
        toValue: 0,
        duration: gameState.time_left * 1000,
        useNativeDriver: false,
      }).start();

      // Timer countdown
      timerRef.current = setInterval(() => {
        setGameState(prev => {
          if (prev.time_left <= 1) {
            // Time's up - show results
            handleTimeUp();
            return { ...prev, time_left: 0, status: 'results' };
          }
          return { ...prev, time_left: prev.time_left - 1 };
        });
      }, 1000);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [gameState.status, gameState.current_question]);

  const startNextQuestion = () => {
    if (gameState.current_question >= gameState.total_questions) {
      setGameState(prev => ({ ...prev, status: 'finished' }));
      return;
    }

    setSelectedAnswer(null);
    setHasAnswered(false);
    setShowCorrectAnswer(false);
    progressAnimation.setValue(1);
    
    setGameState(prev => ({
      ...prev,
      status: 'question',
      time_left: 30,
      current_answers: [],
    }));
  };

  const handleAnswerSelect = (answerIndex: number) => {
    if (hasAnswered || gameState.status !== 'question') return;
    
    setSelectedAnswer(answerIndex);
    setHasAnswered(true);
    
    const currentQuestion = sampleQuestions[gameState.current_question];
    const isCorrect = answerIndex === currentQuestion.correct_answer;
    const timeTaken = 30 - gameState.time_left;
    
    // Calculate points (more points for faster answers and correct answers)
    const basePoints = isCorrect ? 100 : 0;
    const speedBonus = isCorrect ? Math.max(0, 30 - timeTaken) * 2 : 0;
    const points = basePoints + speedBonus;
    
    const playerAnswer: PlayerAnswer = {
      user_id: user?.id || '1',
      user_name: user?.full_name || 'You',
      answer: answerIndex,
      time_taken: timeTaken,
      is_correct: isCorrect,
    };

    // Simulate other players answering
    const simulatedAnswers: PlayerAnswer[] = gameState.participants
      .filter(p => p.id !== user?.id)
      .map(participant => {
        const randomAnswer = Math.floor(Math.random() * currentQuestion.options.length);
        const randomTime = Math.random() * 25 + 5;
        const isPlayerCorrect = Math.random() > 0.4 ? randomAnswer === currentQuestion.correct_answer : false;
        
        return {
          user_id: participant.id,
          user_name: participant.name,
          answer: isPlayerCorrect ? currentQuestion.correct_answer : randomAnswer,
          time_taken: randomTime,
          is_correct: isPlayerCorrect,
        };
      });

    setTimeout(() => {
      setShowCorrectAnswer(true);
      setGameState(prev => ({
        ...prev,
        status: 'results',
        current_answers: [playerAnswer, ...simulatedAnswers],
        participants: prev.participants.map(p => {
          const answer = [playerAnswer, ...simulatedAnswers].find(a => a.user_id === p.id);
          if (answer) {
            const answerPoints = answer.is_correct ? 100 + Math.max(0, 30 - answer.time_taken) * 2 : 0;
            return {
              ...p,
              score: p.score + answerPoints,
              correct_answers: p.correct_answers + (answer.is_correct ? 1 : 0),
            };
          }
          return p;
        }),
      }));
    }, 1500);
  };

  const handleTimeUp = () => {
    if (!hasAnswered) {
      // Player didn't answer in time
      const playerAnswer: PlayerAnswer = {
        user_id: user?.id || '1',
        user_name: user?.full_name || 'You',
        answer: -1, // No answer
        time_taken: 30,
        is_correct: false,
      };
      
      setGameState(prev => ({
        ...prev,
        current_answers: [playerAnswer],
      }));
    }
    setShowCorrectAnswer(true);
  };

  const nextQuestion = () => {
    setGameState(prev => ({
      ...prev,
      current_question: prev.current_question + 1,
    }));
    
    setTimeout(() => {
      startNextQuestion();
    }, 500);
  };

  const currentQuestion = sampleQuestions[gameState.current_question];
  
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
              Trivia Challenge
            </Text>
          </TouchableOpacity>
          
          <View className="flex-row items-center">
            <Text className="text-sm text-gray-600 mr-2">Question</Text>
            <View className="bg-blue-100 px-2 py-1 rounded">
              <Text className="text-blue-800 font-medium">
                {gameState.current_question + 1}/{gameState.total_questions}
              </Text>
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
          
          {gameState.status === 'question' && (
            <View className="flex-row items-center">
              <Clock size={20} color="#EF4444" />
              <Text className="text-red-600 font-bold ml-2">
                {gameState.time_left}s
              </Text>
            </View>
          )}
        </View>
        
        {gameState.status === 'question' && (
          <View className="mt-3">
            <View className="bg-gray-200 h-2 rounded-full overflow-hidden">
              <Animated.View
                className="bg-blue-500 h-full"
                style={{
                  width: progressAnimation.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%'],
                  }),
                }}
              />
            </View>
          </View>
        )}
      </Card>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Question */}
        {gameState.status !== 'finished' && currentQuestion && (
          <Card variant="elevated" className="mx-4 mb-4">
            <View className="flex-row items-start justify-between mb-4">
              <View className="flex-1">
                <Text className="text-lg font-semibold text-gray-900 mb-2">
                  {currentQuestion.question}
                </Text>
                
                <View className="flex-row items-center">
                  <View className={`px-2 py-1 rounded text-xs mr-2 ${
                    currentQuestion.difficulty === 'easy' 
                      ? 'bg-green-100' 
                      : currentQuestion.difficulty === 'medium'
                      ? 'bg-yellow-100'
                      : 'bg-red-100'
                  }`}>
                    <Text className={`text-xs font-medium ${
                      currentQuestion.difficulty === 'easy'
                        ? 'text-green-800'
                        : currentQuestion.difficulty === 'medium'
                        ? 'text-yellow-800'
                        : 'text-red-800'
                    }`}>
                      {currentQuestion.difficulty}
                    </Text>
                  </View>
                  
                  <Text className="text-sm text-gray-600">
                    {currentQuestion.category}
                  </Text>
                </View>
              </View>
              
              <Brain size={32} color="#3B82F6" />
            </View>

            {/* Answer Options */}
            <View className="space-y-3">
              {currentQuestion.options.map((option, index) => {
                const isSelected = selectedAnswer === index;
                const isCorrect = index === currentQuestion.correct_answer;
                const showResult = showCorrectAnswer;
                
                let buttonStyle = 'border border-gray-300 bg-white';
                let textStyle = 'text-gray-700';
                let icon = null;
                
                if (showResult) {
                  if (isCorrect) {
                    buttonStyle = 'border border-green-500 bg-green-50';
                    textStyle = 'text-green-800';
                    icon = <CheckCircle size={20} color="#10B981" />;
                  } else if (isSelected && !isCorrect) {
                    buttonStyle = 'border border-red-500 bg-red-50';
                    textStyle = 'text-red-800';
                    icon = <XCircle size={20} color="#EF4444" />;
                  }
                } else if (isSelected) {
                  buttonStyle = 'border border-blue-500 bg-blue-50';
                  textStyle = 'text-blue-800';
                }
                
                return (
                  <TouchableOpacity
                    key={index}
                    onPress={() => handleAnswerSelect(index)}
                    disabled={hasAnswered || gameState.status !== 'question'}
                    className={`p-4 rounded-lg flex-row items-center justify-between ${buttonStyle}`}
                  >
                    <Text className={`flex-1 font-medium ${textStyle}`}>
                      {String.fromCharCode(65 + index)}. {option}
                    </Text>
                    {icon}
                  </TouchableOpacity>
                );
              })}
            </View>
          </Card>
        )}

        {/* Results */}
        {gameState.status === 'results' && (
          <Card variant="elevated" className="mx-4 mb-4">
            <Text className="text-lg font-semibold text-gray-900 mb-4">
              Round Results
            </Text>
            
            {gameState.current_answers
              .sort((a, b) => {
                if (a.is_correct && !b.is_correct) return -1;
                if (!a.is_correct && b.is_correct) return 1;
                return a.time_taken - b.time_taken;
              })
              .map((answer, index) => (
                <View key={answer.user_id} className="flex-row items-center justify-between py-2">
                  <View className="flex-row items-center flex-1">
                    <View className={`w-6 h-6 rounded-full items-center justify-center mr-3 ${
                      answer.is_correct ? 'bg-green-400' : 'bg-red-400'
                    }`}>
                      {answer.is_correct ? (
                        <CheckCircle size={12} color="#FFFFFF" />
                      ) : (
                        <XCircle size={12} color="#FFFFFF" />
                      )}
                    </View>
                    
                    <View className="flex-1">
                      <Text className="font-medium text-gray-900">
                        {answer.user_name}
                      </Text>
                      <Text className="text-sm text-gray-600">
                        {answer.time_taken.toFixed(1)}s • {
                          answer.answer === -1 
                            ? 'No answer' 
                            : `Answer: ${String.fromCharCode(65 + answer.answer)}`
                        }
                      </Text>
                    </View>
                  </View>
                  
                  <Text className="text-lg font-bold text-blue-600">
                    +{answer.is_correct ? 100 + Math.max(0, 30 - answer.time_taken) * 2 : 0}
                  </Text>
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
                  <View className={`w-8 h-8 rounded-full items-center justify-center mr-3 ${
                    index === 0 ? 'bg-yellow-400' : 
                    index === 1 ? 'bg-gray-300' :
                    index === 2 ? 'bg-orange-400' : 'bg-gray-200'
                  }`}>
                    {index < 3 ? (
                      <Trophy size={16} color="#FFFFFF" />
                    ) : (
                      <Text className="text-xs font-bold text-gray-600">
                        {index + 1}
                      </Text>
                    )}
                  </View>
                  
                  <View>
                    <Text className="font-medium text-gray-900">
                      {participant.name}
                    </Text>
                    <Text className="text-sm text-gray-600">
                      {participant.correct_answers}/{gameState.current_question + (gameState.status === 'results' ? 1 : 0)} correct
                    </Text>
                  </View>
                </View>
                
                <View className="items-end">
                  <Text className="text-lg font-bold text-blue-600">
                    {participant.score}
                  </Text>
                  <View className="flex-row items-center">
                    <Star size={12} color="#F59E0B" />
                    <Text className="text-xs text-gray-600 ml-1">
                      {Math.round((participant.correct_answers / Math.max(1, gameState.current_question + (gameState.status === 'results' ? 1 : 0))) * 100)}%
                    </Text>
                  </View>
                </View>
              </View>
            ))}
        </Card>

        {/* Final Results */}
        {gameState.status === 'finished' && (
          <Card variant="elevated" className="mx-4 mb-4">
            <View className="items-center py-6">
              <Trophy size={48} color="#F59E0B" />
              <Text className="text-2xl font-bold text-gray-900 mt-4 mb-2">
                Game Finished!
              </Text>
              
              <Text className="text-lg text-gray-600 mb-4">
                Winner: {gameState.participants.sort((a, b) => b.score - a.score)[0]?.name}
              </Text>
              
              <Button
                title="Play Again"
                onPress={() => {
                  setGameState({
                    ...gameState,
                    status: 'waiting',
                    current_question: 0,
                    participants: gameState.participants.map(p => ({ ...p, score: 0, correct_answers: 0 })),
                  });
                }}
                variant="primary"
                leftIcon={<Brain size={18} color="#FFFFFF" />}
              />
            </View>
          </Card>
        )}
      </ScrollView>

      {/* Control Buttons */}
      {gameState.status !== 'finished' && (
        <View className="mx-4 mb-4">
          {gameState.status === 'waiting' ? (
            <Button
              title="Start Question"
              onPress={startNextQuestion}
              variant="primary"
              leftIcon={<Brain size={18} color="#FFFFFF" />}
            />
          ) : gameState.status === 'results' ? (
            <Button
              title={gameState.current_question + 1 >= gameState.total_questions ? "View Final Results" : "Next Question"}
              onPress={nextQuestion}
              variant="primary"
              leftIcon={<ArrowLeft size={18} color="#FFFFFF" style={{ transform: [{ rotate: '180deg' }] }} />}
            />
          ) : null}
        </View>
      )}
    </View>
  );
}