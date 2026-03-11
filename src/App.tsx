import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Trophy, 
  Zap, 
  BookOpen, 
  Search, 
  Gamepad2, 
  CheckCircle2, 
  XCircle, 
  ArrowRight,
  ChevronRight,
  Star,
  ShieldCheck,
  Code2,
  BrainCircuit,
  Rocket,
  MessageSquare,
  Mic,
  Image as ImageIcon,
  Play,
  ExternalLink,
  Loader2,
  Send,
  MapPin
} from 'lucide-react';
import { generateQuest, generateTopicExplanation, Quest, QuestType, animateTopicImage, getChatResponse } from './services/geminiService';
import { cn } from './lib/utils';
import Markdown from 'react-markdown';
import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";

// --- Types ---

declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

// --- Components ---

const GlitterCursor = () => {
  const [particles, setParticles] = useState<{ id: number; x: number; y: number; size: number; color: string }[]>([]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const newParticle = {
        id: Date.now() + Math.random(),
        x: e.clientX,
        y: e.clientY,
        size: Math.random() * 4 + 2,
        color: `hsl(${Math.random() * 60 + 200}, 80%, 70%)`, // Blueish/purpleish sparkles
      };
      setParticles(prev => [...prev.slice(-20), newParticle]);
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-[9999] overflow-hidden">
      <AnimatePresence>
        {particles.map(p => (
          <motion.div
            key={p.id}
            initial={{ opacity: 1, scale: 1, x: p.x, y: p.y }}
            animate={{ opacity: 0, scale: 0, y: p.y + 50, x: p.x + (Math.random() - 0.5) * 30 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="absolute rounded-full blur-[1px]"
            style={{
              width: p.size,
              height: p.size,
              backgroundColor: p.color,
              boxShadow: `0 0 10px ${p.color}`,
              left: -p.size / 2,
              top: -p.size / 2,
            }}
          />
        ))}
      </AnimatePresence>
    </div>
  );
};

const DynamicBackground = () => {
  const images = [
    "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&q=80&w=1920", // Space/Tech
    "https://images.unsplash.com/photo-1534774592507-488885376ad3?auto=format&fit=crop&q=80&w=1920", // Abstract/Blue
    "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&q=80&w=1920", // Circuit/Tech
    "https://images.unsplash.com/photo-1507413245164-6160d8298b31?auto=format&fit=crop&q=80&w=1920", // Lab/Science
    "https://images.unsplash.com/photo-1460666819451-7410f5ef139a?auto=format&fit=crop&q=80&w=1920", // Art/Creative
  ];

  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex(prev => (prev + 1) % images.length);
    }, 10000); // Change every 10 seconds
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="fixed inset-0 z-[-2] overflow-hidden bg-black">
      <AnimatePresence mode="wait">
        <motion.div
          key={index}
          initial={{ opacity: 0, scale: 1.1 }}
          animate={{ opacity: 0.4, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 2, ease: "easeInOut" }}
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${images[index]})` }}
        />
      </AnimatePresence>
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/80" />
      <div className="absolute inset-0 backdrop-blur-[2px]" />
    </div>
  );
};

const ProgressBar = ({ current, max, color = "bg-primary" }: { current: number, max: number, color?: string }) => (
  <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
    <motion.div 
      initial={{ width: 0 }}
      animate={{ width: `${(current / max) * 100}%` }}
      className={cn("h-full", color)}
    />
  </div>
);

const QuizGame = ({ content: rawContent, onComplete }: { content: any, onComplete: (points: number) => void }) => {
  const content = Array.isArray(rawContent) ? rawContent : (rawContent?.questions || rawContent?.quiz || []);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [showExplanation, setShowExplanation] = useState(false);

  if (!content || content.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center space-y-4">
        <XCircle size={48} className="text-red-500 opacity-50" />
        <h3 className="text-xl font-bold">Quest Content Missing</h3>
        <p className="text-slate-400">The AI failed to generate the quiz questions. Please try again.</p>
        <button onClick={() => onComplete(0)} className="px-6 py-2 bg-white/10 rounded-xl hover:bg-white/20 transition-colors">Close Quest</button>
      </div>
    );
  }

  const currentQuestion = content[currentIndex] || { question: 'Question not found.', options: [], correctAnswerIndex: 0, explanation: '' };
  const isCorrect = selectedOption === currentQuestion.correctAnswerIndex;

  const handleSelect = (index: number) => {
    if (isAnswered) return;
    setSelectedOption(index);
  };

  const handleCheck = () => {
    if (selectedOption === null || isAnswered) return;
    setIsAnswered(true);
    if (isCorrect) {
      setScore(s => s + 1);
    }
    setShowExplanation(true);
  };

  const nextQuestion = () => {
    if (currentIndex < (content?.length || 0) - 1) {
      setCurrentIndex(currentIndex + 1);
      setSelectedOption(null);
      setIsAnswered(false);
      setShowExplanation(false);
    } else {
      onComplete(Math.round((score / (content?.length || 1)) * 100));
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div className="space-y-1">
          <span className="text-[10px] uppercase tracking-widest text-primary font-bold">Quest Progress</span>
          <div className="flex gap-1.5">
            {content?.map?.((_: any, i: number) => (
              <motion.div 
                key={i} 
                initial={false}
                animate={{ 
                  width: i === currentIndex ? 24 : 8,
                  backgroundColor: i < currentIndex ? "#10b981" : i === currentIndex ? "#6366f1" : "#1e293b"
                }}
                className="h-2 rounded-full transition-all duration-300" 
              />
            ))}
          </div>
        </div>
        <span className="text-xs font-mono text-slate-500">Q{currentIndex + 1} / {content?.length || 5}</span>
      </div>

      <div className="space-y-4">
        <h3 className="text-2xl font-bold leading-tight text-white">
          {currentQuestion.question}
        </h3>
      </div>

      <div className="grid gap-4">
        {currentQuestion.options?.map?.((option: string, i: number) => {
          const isSelected = selectedOption === i;
          const isCorrectOption = i === currentQuestion.correctAnswerIndex;
          
          let borderClass = "border-white/5 bg-white/5 hover:bg-white/10";
          let icon = null;

          if (isAnswered) {
            if (isCorrectOption) {
              borderClass = "border-emerald-500/50 bg-emerald-500/10 text-emerald-400";
              icon = <CheckCircle2 size={18} className="text-emerald-500" />;
            } else if (isSelected) {
              borderClass = "border-red-500/50 bg-red-500/10 text-red-400";
              icon = <XCircle size={18} className="text-red-500" />;
            } else {
              borderClass = "border-white/5 opacity-40";
            }
          } else if (isSelected) {
            borderClass = "border-primary bg-primary/10 ring-1 ring-primary/50 shadow-[0_0_20px_rgba(99,102,241,0.2)]";
          }

          return (
            <motion.button
              key={i}
              whileHover={!isAnswered ? { x: 4 } : {}}
              whileTap={!isAnswered ? { scale: 0.98 } : {}}
              onClick={() => handleSelect(i)}
              disabled={isAnswered}
              className={cn(
                "group relative p-5 rounded-2xl text-left transition-all border-2 flex items-center justify-between overflow-hidden",
                borderClass
              )}
            >
              <div className="flex items-center gap-4 relative z-10">
                <span className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center font-bold transition-all",
                  isSelected ? "bg-primary text-white" : "bg-slate-800 text-slate-400 group-hover:text-slate-200"
                )}>
                  {String.fromCharCode(65 + i)}
                </span>
                <span className="font-medium">{option}</span>
              </div>
              {icon && <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>{icon}</motion.div>}
              
              {isSelected && !isAnswered && (
                <motion.div 
                  layoutId="active-bg"
                  className="absolute inset-0 bg-primary/5 pointer-events-none"
                />
              )}
            </motion.button>
          );
        })}
      </div>

      <div className="pt-4">
        {!isAnswered ? (
          <button
            disabled={selectedOption === null}
            onClick={handleCheck}
            className="w-full py-5 bg-primary hover:bg-primary/90 disabled:opacity-30 disabled:cursor-not-allowed rounded-2xl font-black text-lg tracking-tight transition-all shadow-2xl shadow-primary/30 flex items-center justify-center gap-2"
          >
            Check Answer <ShieldCheck size={22} />
          </button>
        ) : (
          <AnimatePresence>
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className={cn(
                "p-6 rounded-[2rem] border-2 glass relative overflow-hidden",
                isCorrect ? "border-emerald-500/30 bg-emerald-500/5" : "border-red-500/30 bg-red-500/5"
              )}>
                <div className="flex items-start gap-4 relative z-10">
                  <div className={cn(
                    "w-14 h-14 rounded-2xl flex items-center justify-center shrink-0",
                    isCorrect ? "bg-emerald-500/20 text-emerald-500" : "bg-red-500/20 text-red-500"
                  )}>
                    {isCorrect ? <Trophy size={32} /> : <BrainCircuit size={32} />}
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-xl font-black italic uppercase tracking-tighter">
                      {isCorrect ? "Master Rank Confirmed!" : "Learning Opportunity"}
                    </h4>
                    <p className="text-sm text-slate-400 leading-tight">
                      {isCorrect 
                        ? "Your knowledge of this topic is exceptional. Keep the momentum!" 
                        : `The correct path was: ${currentQuestion.options[currentQuestion.correctAnswerIndex]}`}
                    </p>
                  </div>
                </div>

                <div className="mt-6 p-5 rounded-2xl bg-white/5 border border-white/5 space-y-2">
                  <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-primary">
                    <BookOpen size={12} /> Detailed Explanation
                  </div>
                  <p className="text-sm text-slate-300 leading-relaxed">
                    {currentQuestion.explanation}
                  </p>
                </div>
              </div>

              <button 
                onClick={nextQuestion}
                className="w-full py-5 bg-white text-slate-950 hover:bg-slate-200 rounded-2xl font-black text-lg flex items-center justify-center gap-2 transition-all shadow-xl"
              >
                {currentIndex === content.length - 1 ? "Complete Quest" : "Next Question"} <ArrowRight size={22} />
              </button>
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
};

const CodingGame = ({ content: rawContent, onComplete }: { content: any, onComplete: (points: number) => void }) => {
  const content = rawContent?.task ? rawContent : (rawContent?.challenge || rawContent?.content || {});
  const [code, setCode] = useState(content?.starterCode || "");
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [feedback, setFeedback] = useState("");

  if (!content || !content.task) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center space-y-4">
        <XCircle size={48} className="text-red-500 opacity-50" />
        <h3 className="text-xl font-bold">Mission Data Corrupted</h3>
        <p className="text-slate-400">The coding challenge could not be loaded. Please try a different quest.</p>
        <button onClick={() => onComplete(0)} className="px-6 py-2 bg-white/10 rounded-xl hover:bg-white/20 transition-colors">Close Quest</button>
      </div>
    );
  }

  const checkCode = () => {
    const normalizedCode = code.replace(/\s/g, '');
    const normalizedSolution = (content?.solution || "").replace(/\s/g, '');
    
    if (normalizedCode === normalizedSolution) {
      setIsCorrect(true);
      setFeedback("Perfect! You solved the logic puzzle.");
    } else {
      setIsCorrect(false);
      setFeedback("Not quite right. Check the syntax or logic again!");
    }
  };

  return (
    <div className="space-y-6">
      <div className="p-6 rounded-3xl bg-slate-900/80 border border-white/10 glass">
        <h3 className="text-xl font-bold mb-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center text-primary">
            <Code2 size={24} />
          </div>
          Mission: {content?.task}
        </h3>
        <div className="flex flex-wrap gap-2">
          {content?.hints?.map?.((hint: string, i: number) => (
            <div key={i} className="group relative">
              <span className="text-[10px] uppercase tracking-widest px-3 py-1.5 rounded-full bg-white/5 text-slate-400 border border-white/5 hover:border-primary/30 transition-colors cursor-help">
                Hint {i+1}
              </span>
              <div className="absolute bottom-full left-0 mb-2 w-48 p-3 bg-slate-900 border border-white/10 rounded-xl text-xs text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 shadow-2xl">
                {hint}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="relative group">
        <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 to-secondary/20 rounded-[2rem] blur-xl opacity-50 group-hover:opacity-100 transition duration-1000"></div>
        <div className="relative bg-slate-950 rounded-[2rem] border border-white/10 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-3 bg-white/5 border-b border-white/5">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-500/50" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/50" />
              <div className="w-3 h-3 rounded-full bg-green-500/50" />
            </div>
            <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">{content?.language || "javascript"}</span>
          </div>
          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="w-full h-64 p-6 font-mono text-sm bg-transparent outline-none resize-none text-emerald-400 selection:bg-primary/30"
            spellCheck={false}
          />
        </div>
      </div>

      <div className="flex gap-4">
        <button 
          onClick={checkCode}
          className="flex-1 py-5 bg-primary hover:bg-primary/90 rounded-2xl font-black text-lg tracking-tight transition-all shadow-2xl shadow-primary/30 flex items-center justify-center gap-2"
        >
          Execute Script <Play size={20} />
        </button>
      </div>

      <AnimatePresence>
        {isCorrect !== null && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              "p-6 rounded-[2rem] border-2 glass flex items-center gap-4",
              isCorrect ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-400" : "border-red-500/30 bg-red-500/5 text-red-400"
            )}
          >
            <div className={cn(
              "w-12 h-12 rounded-xl flex items-center justify-center shrink-0",
              isCorrect ? "bg-emerald-500/20" : "bg-red-500/20"
            )}>
              {isCorrect ? <CheckCircle2 size={24} /> : <XCircle size={24} />}
            </div>
            <div className="flex-1">
              <p className="font-bold text-lg">{feedback}</p>
              {isCorrect && (
                <button 
                  onClick={() => onComplete(100)}
                  className="mt-1 text-sm font-bold uppercase tracking-widest text-primary hover:underline flex items-center gap-1"
                >
                  Claim Rewards <ArrowRight size={14} />
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const ConceptMatchGame = ({ content: rawContent, onComplete }: { content: any, onComplete: (points: number) => void }) => {
  const content = rawContent?.pairs ? rawContent : { pairs: Array.isArray(rawContent) ? rawContent : (rawContent?.items || []) };
  const [selectedLeft, setSelectedLeft] = useState<number | null>(null);
  const [matches, setMatches] = useState<Record<number, number>>({});
  const [wrongMatch, setWrongMatch] = useState<{left: number, right: number} | null>(null);

  const pairs = content?.pairs || [];
  if (pairs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center space-y-4">
        <XCircle size={48} className="text-red-500 opacity-50" />
        <h3 className="text-xl font-bold">Alignment Data Missing</h3>
        <p className="text-slate-400">No concepts found to match. Please try again.</p>
        <button onClick={() => onComplete(0)} className="px-6 py-2 bg-white/10 rounded-xl hover:bg-white/20 transition-colors">Close Quest</button>
      </div>
    );
  }
  const leftItems = pairs.map((p: any, i: number) => ({ text: p.left, id: i }));
  const rightItems = [...pairs].map((p: any, i: number) => ({ text: p.right, id: i })).sort(() => Math.random() - 0.5);

  const handleMatch = (rightId: number) => {
    if (selectedLeft === null) return;
    
    if (selectedLeft === rightId) {
      setMatches(prev => ({ ...prev, [selectedLeft]: rightId }));
      setSelectedLeft(null);
      if (Object.keys(matches).length + 1 === pairs.length) {
        setTimeout(() => onComplete(100), 1000);
      }
    } else {
      setWrongMatch({ left: selectedLeft, right: rightId });
      setTimeout(() => {
        setWrongMatch(null);
        setSelectedLeft(null);
      }, 1000);
    }
  };

  return (
    <div className="space-y-8">
      <div className="text-center space-y-2">
        <h3 className="text-2xl font-bold">Concept Alignment</h3>
        <p className="text-slate-400 text-sm">Match the related concepts by selecting one from each side.</p>
      </div>

      <div className="grid grid-cols-2 gap-8">
        <div className="space-y-3">
          {leftItems.map((item: any) => (
            <button
              key={item.id}
              disabled={matches[item.id] !== undefined}
              onClick={() => setSelectedLeft(item.id)}
              className={cn(
                "w-full p-4 rounded-2xl text-left border-2 transition-all",
                matches[item.id] !== undefined 
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400 opacity-50" 
                  : selectedLeft === item.id 
                  ? "border-primary bg-primary/10 shadow-lg shadow-primary/20" 
                  : wrongMatch?.left === item.id
                  ? "border-red-500 bg-red-500/10 animate-shake"
                  : "border-white/5 bg-white/5 hover:bg-white/10"
              )}
            >
              {item.text}
            </button>
          ))}
        </div>
        <div className="space-y-3">
          {rightItems.map((item: any) => (
            <button
              key={item.id}
              disabled={Object.values(matches).includes(item.id)}
              onClick={() => handleMatch(item.id)}
              className={cn(
                "w-full p-4 rounded-2xl text-left border-2 transition-all",
                Object.values(matches).includes(item.id)
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400 opacity-50" 
                  : wrongMatch?.right === item.id
                  ? "border-red-500 bg-red-500/10 animate-shake"
                  : "border-white/5 bg-white/5 hover:bg-white/10"
              )}
            >
              {item.text}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

const StoryAdventureGame = ({ content: rawContent, onComplete }: { content: any, onComplete: (points: number) => void }) => {
  const content = rawContent?.story_parts ? rawContent : { story_parts: Array.isArray(rawContent) ? rawContent : (rawContent?.parts || []) };
  const [currentPartIndex, setCurrentPartIndex] = useState(0);
  const [totalPoints, setTotalPoints] = useState(0);
  const currentPart = content?.story_parts?.[currentPartIndex];

  if (!currentPart) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center space-y-4">
        <XCircle size={48} className="text-red-500 opacity-50" />
        <h3 className="text-xl font-bold">Adventure Log Empty</h3>
        <p className="text-slate-400">The story could not be generated. Please try again.</p>
        <button onClick={() => onComplete(0)} className="px-6 py-2 bg-white/10 rounded-xl hover:bg-white/20 transition-colors">Close Quest</button>
      </div>
    );
  }

  const handleChoice = (choice: any) => {
    setTotalPoints(prev => prev + (choice.points_reward || 0));
    if (choice.next_part_index !== undefined && content.story_parts[choice.next_part_index]) {
      setCurrentPartIndex(choice.next_part_index);
    } else {
      onComplete(100);
    }
  };

  return (
    <div className="space-y-8">
      <div className="p-8 rounded-[2.5rem] bg-white/5 border border-white/10 glass relative overflow-hidden">
        <div className="absolute top-0 right-0 p-6">
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-primary/20 text-primary font-bold text-xs border border-primary/30">
            <Zap size={14} /> {totalPoints} XP
          </div>
        </div>
        <div className="prose prose-invert max-w-none">
          <p className="text-xl leading-relaxed text-slate-200 italic">
            "{currentPart?.text}"
          </p>
        </div>
      </div>

      <div className="grid gap-4">
        {currentPart?.choices?.map((choice: any, i: number) => (
          <button
            key={i}
            onClick={() => handleChoice(choice)}
            className="group p-6 rounded-2xl bg-white/5 border border-white/10 hover:border-primary/50 hover:bg-primary/5 transition-all text-left flex items-center justify-between"
          >
            <span className="font-bold text-slate-300 group-hover:text-white transition-colors">{choice.text}</span>
            <ChevronRight size={20} className="text-slate-600 group-hover:text-primary transition-colors" />
          </button>
        ))}
      </div>
    </div>
  );
};

const ShortAnswerGame = ({ content: rawContent, onComplete }: { content: any, onComplete: (points: number) => void }) => {
  const content = rawContent?.question ? rawContent : (rawContent?.content || rawContent?.data || {});
  const [answer, setAnswer] = useState("");
  const [isAnswered, setIsAnswered] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);

  if (!content || !content.question) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center space-y-4">
        <XCircle size={48} className="text-red-500 opacity-50" />
        <h3 className="text-xl font-bold">Question Not Found</h3>
        <p className="text-slate-400">The short answer challenge is missing its core question.</p>
        <button onClick={() => onComplete(0)} className="px-6 py-2 bg-white/10 rounded-xl hover:bg-white/20 transition-colors">Close Quest</button>
      </div>
    );
  }

  const handleCheck = () => {
    if (!answer.trim()) return;
    const normalizedAnswer = answer.trim().toLowerCase();
    const isRight = content.acceptedAnswers.some((a: string) => a.toLowerCase() === normalizedAnswer);
    setIsCorrect(isRight);
    setIsAnswered(true);
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div className="space-y-1">
          <span className="text-[10px] uppercase tracking-widest text-primary font-bold">Quest Progress</span>
          <div className="flex gap-1.5">
            <motion.div 
              initial={false}
              animate={{ width: 24, backgroundColor: "#6366f1" }}
              className="h-2 rounded-full" 
            />
          </div>
        </div>
        <span className="text-xs font-mono text-slate-500">Q1 / 1</span>
      </div>

      <div className="space-y-4">
        <h3 className="text-2xl font-bold leading-tight text-white">
          {content.question}
        </h3>
      </div>

      <div className="space-y-6">
        <div className="space-y-2">
          <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold ml-1">Your Answer</label>
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 to-secondary/20 rounded-2xl blur-lg opacity-50 group-hover:opacity-100 transition duration-500"></div>
            <input
              type="text"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              disabled={isAnswered}
              autoFocus
              placeholder={content.placeholder || "Type your answer here..."}
              className="relative w-full p-6 bg-slate-900 border-2 border-white/10 rounded-2xl text-xl outline-none focus:border-primary transition-all disabled:opacity-50 text-white"
              onKeyDown={(e) => e.key === 'Enter' && handleCheck()}
            />
          </div>
        </div>

        {!isAnswered ? (
          <button
            onClick={handleCheck}
            disabled={!answer.trim()}
            className="w-full py-5 bg-primary hover:bg-primary/90 disabled:opacity-30 rounded-2xl font-black text-lg flex items-center justify-center gap-2 transition-all shadow-xl shadow-primary/20"
          >
            Check Answer <ShieldCheck size={22} />
          </button>
        ) : (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className={cn(
              "p-6 rounded-[2rem] border-2 glass",
              isCorrect ? "border-emerald-500/30 bg-emerald-500/5" : "border-red-500/30 bg-red-500/5"
            )}>
              <div className="flex items-start gap-4">
                <div className={cn(
                  "w-14 h-14 rounded-2xl flex items-center justify-center shrink-0",
                  isCorrect ? "bg-emerald-500/20 text-emerald-500" : "bg-red-500/20 text-red-500"
                )}>
                  {isCorrect ? <Trophy size={32} /> : <BrainCircuit size={32} />}
                </div>
                <div className="space-y-1">
                  <h4 className="text-xl font-black italic uppercase">
                    {isCorrect ? "Correct!" : "Not quite right"}
                  </h4>
                  <p className="text-sm text-slate-400">
                    {isCorrect ? "Great job! You've mastered this concept." : `The correct answer was: ${content.acceptedAnswers[0]}`}
                  </p>
                </div>
              </div>
              <div className="mt-6 p-5 rounded-2xl bg-white/5 border border-white/5 space-y-2">
                <p className="text-sm text-slate-300 leading-relaxed">
                  {content.explanation}
                </p>
              </div>
            </div>
            <button 
              onClick={() => onComplete(isCorrect ? 100 : 0)}
              className="w-full py-5 bg-white text-slate-950 hover:bg-slate-200 rounded-2xl font-black text-lg flex items-center justify-center gap-2 transition-all shadow-xl"
            >
              Complete Quest <ArrowRight size={22} />
            </button>
          </motion.div>
        )}
      </div>
    </div>
  );
};

const LiveAudioSession = ({ onClose }: { onClose: () => void }) => {
  const [isActive, setIsActive] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);

  const startSession = async () => {
    setIsConnecting(true);
    // Implementation of Live API would go here using Web Audio API
    // For now, we simulate the connection state
    setTimeout(() => {
      setIsConnecting(false);
      setIsActive(true);
      setTranscript("EduBot: Hello! I'm listening. Ask me anything about any topic...");
    }, 2000);
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[150] bg-black/90 backdrop-blur-xl flex items-center justify-center p-6"
    >
      <div className="max-w-md w-full glass rounded-[3rem] p-12 text-center space-y-8 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-secondary to-accent animate-pulse" />
        
        <div className="relative">
          <div className={cn(
            "w-32 h-32 rounded-full mx-auto flex items-center justify-center transition-all duration-500",
            isActive ? "bg-primary shadow-[0_0_50px_rgba(99,102,241,0.5)] scale-110" : "bg-slate-800"
          )}>
            {isActive ? (
              <motion.div 
                animate={{ scale: [1, 1.2, 1] }} 
                transition={{ repeat: Infinity, duration: 1.5 }}
              >
                <Mic size={48} className="text-white" />
              </motion.div>
            ) : (
              <Mic size={48} className="text-slate-500" />
            )}
          </div>
          {isActive && (
            <div className="absolute -inset-4 border-2 border-primary/30 rounded-full animate-ping" />
          )}
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-bold">{isActive ? "Listening..." : "Live Voice Tutor"}</h2>
          <p className="text-slate-400 text-sm">Have a real-time conversation with EduBot about any topic.</p>
        </div>

        <div className="h-24 bg-white/5 rounded-2xl p-4 text-sm text-slate-300 italic overflow-y-auto">
          {isConnecting ? "Establishing secure link..." : transcript || "Click start to begin your voice session."}
        </div>

        <div className="flex gap-4">
          {!isActive ? (
            <button 
              onClick={startSession}
              disabled={isConnecting}
              className="flex-1 py-4 bg-primary rounded-2xl font-bold flex items-center justify-center gap-2"
            >
              {isConnecting ? <Loader2 className="animate-spin" /> : <><Play size={20} /> Start Session</>}
            </button>
          ) : (
            <button 
              onClick={() => setIsActive(false)}
              className="flex-1 py-4 bg-red-500/20 text-red-500 border border-red-500/50 rounded-2xl font-bold"
            >
              End Session
            </button>
          )}
          <button 
            onClick={onClose}
            className="px-6 py-4 bg-slate-800 rounded-2xl font-bold"
          >
            Close
          </button>
        </div>
      </div>
    </motion.div>
  );
};

const ImageGenerator = ({ onClose }: { onClose: () => void }) => {
  const [activeTab, setActiveTab] = useState<'generate' | 'animate'>('generate');
  const [prompt, setPrompt] = useState("");
  const [size, setSize] = useState<"1K" | "2K" | "4K">("1K");
  const [isGenerating, setIsGenerating] = useState(false);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [videoResult, setVideoResult] = useState<string | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setUploadedImage(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    
    // Check for API Key for Pro models
    const hasKey = await window.aistudio.hasSelectedApiKey();
    if (!hasKey) {
      await window.aistudio.openSelectKey();
      // Proceed after opening (race condition handled by assuming success as per guidelines)
    }

    setIsGenerating(true);
    setResultImage(null);
    try {
      const dynamicAi = new GoogleGenAI({ apiKey: process.env.API_KEY || process.env.GEMINI_API_KEY || "" });
      const response = await dynamicAi.models.generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: { parts: [{ text: prompt }] },
        config: { imageConfig: { imageSize: size, aspectRatio: "1:1" } },
      });
      
      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          setResultImage(`data:image/png;base64,${part.inlineData.data}`);
          break;
        }
      }
    } catch (error: any) {
      console.error("Image generation failed", error);
      if (error.message?.includes("Requested entity was not found")) {
        await window.aistudio.openSelectKey();
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAnimate = async () => {
    const imgToAnimate = uploadedImage || resultImage;
    if (!imgToAnimate) return;

    // Check for API Key for Veo
    const hasKey = await window.aistudio.hasSelectedApiKey();
    if (!hasKey) {
      await window.aistudio.openSelectKey();
    }

    setIsGenerating(true);
    setVideoResult(null);
    try {
      const videoUrl = await animateTopicImage(imgToAnimate, prompt || "Animate this scene");
      setVideoResult(videoUrl);
    } catch (error: any) {
      console.error("Animation failed", error);
      if (error.message?.includes("Requested entity was not found")) {
        await window.aistudio.openSelectKey();
      }
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="fixed inset-0 z-[150] flex items-center justify-center p-6 bg-black/60 backdrop-blur-md"
    >
      <div className="max-w-2xl w-full glass rounded-[2.5rem] p-8 space-y-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <ImageIcon className="text-secondary" /> Creative Studio
          </h2>
          <button onClick={onClose}><XCircle className="text-slate-500" /></button>
        </div>

        <div className="flex gap-4 border-b border-white/10 pb-4">
          <button 
            onClick={() => setActiveTab('generate')}
            className={cn("pb-2 px-2 text-sm font-bold transition-all border-b-2", activeTab === 'generate' ? "border-secondary text-white" : "border-transparent text-slate-500")}
          >
            Generate Image
          </button>
          <button 
            onClick={() => setActiveTab('animate')}
            className={cn("pb-2 px-2 text-sm font-bold transition-all border-b-2", activeTab === 'animate' ? "border-secondary text-white" : "border-transparent text-slate-500")}
          >
            Animate with Veo
          </button>
        </div>

        {activeTab === 'generate' ? (
          <div className="space-y-4">
            <textarea 
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe the image you want to generate for this topic..."
              className="w-full h-32 bg-white/5 border border-white/10 rounded-2xl p-4 outline-none focus:border-secondary transition-all"
            />
            
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                {(["1K", "2K", "4K"] as const).map(s => (
                  <button 
                    key={s}
                    onClick={() => setSize(s)}
                    className={cn(
                      "px-4 py-2 rounded-xl text-xs font-bold transition-all",
                      size === s ? "bg-secondary text-white" : "bg-white/5 text-slate-400 hover:bg-white/10"
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <button 
                onClick={handleGenerate}
                disabled={isGenerating || !prompt.trim()}
                className="px-8 py-3 bg-secondary hover:bg-secondary/80 disabled:opacity-50 rounded-xl font-bold flex items-center gap-2"
              >
                {isGenerating ? <Loader2 className="animate-spin" /> : "Generate Image"}
              </button>
            </div>
            {resultImage && (
              <div className="space-y-4">
                <div className="aspect-square w-full rounded-2xl overflow-hidden border border-white/10">
                  <img src={resultImage} alt="Generated" className="w-full h-full object-cover" />
                </div>
                <button 
                  onClick={() => setActiveTab('animate')}
                  className="w-full py-3 bg-white/5 hover:bg-white/10 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
                >
                  <Play size={16} /> Animate this result
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            <div className="p-8 border-2 border-dashed border-white/10 rounded-3xl text-center space-y-4 hover:border-secondary/50 transition-colors relative">
              <input 
                type="file" 
                accept="image/*" 
                onChange={handleFileUpload}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              {uploadedImage ? (
                <img src={uploadedImage} className="max-h-48 mx-auto rounded-xl" />
              ) : (
                <>
                  <ImageIcon size={48} className="mx-auto text-slate-600" />
                  <p className="text-sm text-slate-400">Click or drag to upload a photo to animate</p>
                </>
              )}
            </div>

            <div className="space-y-4">
              <input 
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe how to animate it (e.g., 'Subtle movement of leaves')"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-secondary"
              />
              <button 
                onClick={handleAnimate}
                disabled={isGenerating || (!uploadedImage && !resultImage)}
                className="w-full py-4 bg-secondary hover:bg-secondary/80 disabled:opacity-50 rounded-2xl font-bold flex items-center justify-center gap-2"
              >
                {isGenerating ? <Loader2 className="animate-spin" /> : <><Play size={20} /> Generate Veo Video</>}
              </button>
            </div>

            {videoResult && (
              <div className="aspect-video w-full rounded-2xl overflow-hidden border border-white/10">
                <video src={videoResult} autoPlay loop muted className="w-full h-full object-cover" />
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
};

const ChatBot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{ role: 'user' | 'bot', text: string }[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  const handleSend = async () => {
    if (!input.trim()) return;
    const userMsg = input;
    setInput("");
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsTyping(true);

    try {
      const response = await getChatResponse(userMsg, messages);
      setMessages(prev => [...prev, { role: 'bot', text: response || "I'm sorry, I couldn't process that." }]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'bot', text: "Error connecting to EduBot." }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-[100]">
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="mb-4 w-80 md:w-96 h-[500px] glass rounded-3xl flex flex-col overflow-hidden shadow-2xl"
          >
            <div className="p-4 bg-primary/20 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                  <BrainCircuit size={18} className="text-white" />
                </div>
                <span className="font-bold">EduBot Tutor</span>
              </div>
              <button onClick={() => setIsOpen(false)}><XCircle size={20} className="text-slate-400" /></button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 && (
                <div className="text-center text-slate-500 mt-10">
                  <MessageSquare size={40} className="mx-auto mb-2 opacity-20" />
                  <p className="text-sm">Ask me anything about any topic!</p>
                </div>
              )}
              {messages.map((msg, i) => (
                <div key={i} className={cn("flex", msg.role === 'user' ? "justify-end" : "justify-start")}>
                  <div className={cn(
                    "max-w-[85%] p-3 rounded-2xl text-sm",
                    msg.role === 'user' ? "bg-primary text-white rounded-tr-none" : "bg-white/10 text-slate-200 rounded-tl-none"
                  )}>
                    <Markdown>{msg.text}</Markdown>
                  </div>
                </div>
              ))}
              {isTyping && (
                <div className="flex justify-start">
                  <div className="bg-white/10 p-3 rounded-2xl rounded-tl-none flex gap-1">
                    <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1 }} className="w-1.5 h-1.5 bg-slate-400 rounded-full" />
                    <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} className="w-1.5 h-1.5 bg-slate-400 rounded-full" />
                    <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} className="w-1.5 h-1.5 bg-slate-400 rounded-full" />
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-white/10 flex gap-2">
              <input 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Type a message..."
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm outline-none focus:border-primary"
              />
              <button onClick={handleSend} className="p-2 bg-primary rounded-xl text-white"><Send size={18} /></button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-14 h-14 bg-primary rounded-full flex items-center justify-center text-white shadow-xl shadow-primary/30 hover:scale-110 transition-transform"
      >
        {isOpen ? <XCircle size={28} /> : <MessageSquare size={28} />}
      </button>
    </div>
  );
};

export default function App() {
  const [points, setPoints] = useState(0);
  const [level, setLevel] = useState("Intermediate");

  const [searchQuery, setSearchQuery] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [activeQuest, setActiveQuest] = useState<Quest | null>(null);
  const [topicExplanation, setTopicExplanation] = useState<{ explanation: string; imageUrl: string; sources?: any[] } | null>(null);
  const [animatedVideoUrl, setAnimatedVideoUrl] = useState<string | null>(null);
  const [view, setView] = useState<'home' | 'explanation' | 'quest'>('home');
  const [showSuccess, setShowSuccess] = useState(false);
  const [showLiveAudio, setShowLiveAudio] = useState(false);
  const [showImageGen, setShowImageGen] = useState(false);

  const handleSearch = async (e?: React.FormEvent, overrideQuery?: string) => {
    if (e) e.preventDefault();
    const query = overrideQuery || searchQuery;
    if (!query.trim()) return;
    
    setSearchQuery(query);
    setIsGenerating(true);
    setAnimatedVideoUrl(null);

    // Safety timeout to prevent UI from hanging indefinitely
    const timeoutId = setTimeout(() => {
      setIsGenerating(false);
    }, 45000);

    try {
      // Try with grounding first
      const result = await generateTopicExplanation(query, level, true);
      setTopicExplanation(result);
      setView('explanation');
    } catch (error) {
      console.error("Failed to generate explanation with grounding", error);
      // Fallback to a simpler search without grounding
      try {
        const result = await generateTopicExplanation(query, level, false);
        setTopicExplanation(result);
        setView('explanation');
      } catch (retryError) {
        console.error("Retry failed", retryError);
      }
    } finally {
      clearTimeout(timeoutId);
      setIsGenerating(false);
    }
  };

  const handleAnimate = async () => {
    if (!topicExplanation?.imageUrl) return;

    // Check for API Key for Veo
    const hasKey = await window.aistudio.hasSelectedApiKey();
    if (!hasKey) {
      await window.aistudio.openSelectKey();
    }

    setIsAnimating(true);
    try {
      const videoUrl = await animateTopicImage(topicExplanation.imageUrl, searchQuery);
      setAnimatedVideoUrl(videoUrl);
    } catch (error: any) {
      console.error("Animation failed", error);
      if (error.message?.includes("Requested entity was not found")) {
        await window.aistudio.openSelectKey();
      }
    } finally {
      setIsAnimating(false);
    }
  };

  const startQuest = async () => {
    setIsGenerating(true);
    try {
      const quest = await generateQuest(searchQuery, level, true);
      setActiveQuest(quest);
      setView('quest');
    } catch (error) {
      console.error("Failed to generate quest with grounding", error);
      try {
        const quest = await generateQuest(searchQuery, level, false);
        setActiveQuest(quest);
        setView('quest');
      } catch (retryError) {
        console.error("Quest retry failed", retryError);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const completeQuest = (scorePercentage: number) => {
    const earnedPoints = Math.round((activeQuest?.points || 0) * (scorePercentage / 100));
    setPoints(prev => prev + earnedPoints);
    setShowSuccess(true);
    setTimeout(() => {
      setShowSuccess(false);
      setView('home');
      setSearchQuery("");
    }, 3000);
  };

  return (
    <div className="min-h-screen flex flex-col selection:bg-primary/30">
      <DynamicBackground />
      <GlitterCursor />
      
      {/* Header / Nav */}
      <header className="sticky top-0 z-50 glass border-b border-white/10 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
              <Rocket className="text-white" size={24} />
            </div>
            <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
              EduQuest
            </h1>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden lg:flex items-center gap-2">
              <button 
                onClick={() => setShowLiveAudio(true)}
                className="p-2 hover:bg-white/5 rounded-xl text-slate-400 hover:text-primary transition-colors flex items-center gap-2"
              >
                <Mic size={18} /> <span className="text-xs font-bold">Live Tutor</span>
              </button>
              <button 
                onClick={() => setShowImageGen(true)}
                className="p-2 hover:bg-white/5 rounded-xl text-slate-400 hover:text-secondary transition-colors flex items-center gap-2"
              >
                <ImageIcon size={18} /> <span className="text-xs font-bold">Studio</span>
              </button>
            </div>
            <button 
              onClick={() => document.getElementById('search-section')?.scrollIntoView({ behavior: 'smooth' })}
              className="px-6 py-2 bg-primary text-white rounded-full font-bold text-sm hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
            >
              Get Started
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full p-6 space-y-8">
        {/* Home View */}
        {view === 'home' && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8"
          >
            <div id="search-section" className="text-center space-y-8 max-w-3xl mx-auto py-20">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-primary text-sm font-medium backdrop-blur-md"
              >
                <Zap size={16} className="animate-pulse" />
                <span>The Future of Learning is Here</span>
              </motion.div>

              <h2 className="text-6xl md:text-7xl font-bold leading-tight tracking-tight bg-clip-text text-transparent bg-gradient-to-b from-white to-white/40">
                What do you want to <br />
                <span className="text-primary italic font-serif">master</span> today?
              </h2>
              <p className="text-slate-400 text-lg max-w-2xl mx-auto">
                Enter any topic—from Quantum Physics to Modern Art—and our AI will craft a unique learning quest just for you.
              </p>
              
              <form onSubmit={handleSearch} className="relative max-w-xl mx-auto pt-4">
                <input 
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="e.g. Java Inheritance, Photosynthesis, French Revolution..."
                  className="w-full pl-14 pr-32 py-5 bg-white/5 backdrop-blur-xl border-2 border-white/10 rounded-2xl focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all text-lg shadow-2xl shadow-black/20"
                />
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500" size={24} />
                <button 
                  disabled={isGenerating}
                  className="absolute right-3 top-1/2 -translate-y-1/2 px-6 py-2.5 bg-primary hover:bg-primary/80 disabled:opacity-50 rounded-xl font-bold flex items-center gap-2 transition-colors"
                >
                  {isGenerating ? (
                    <motion.div 
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                    >
                      <Zap size={20} />
                    </motion.div>
                  ) : (
                    <>Start Quest <ArrowRight size={20} /></>
                  )}
                </button>
              </form>
            </div>

            {/* Quick Categories */}
            <motion.div 
              variants={{
                hidden: { opacity: 0 },
                show: {
                  opacity: 1,
                  transition: { staggerChildren: 0.1 }
                }
              }}
              initial="hidden"
              animate="show"
              className="grid grid-cols-2 md:grid-cols-4 gap-4"
            >
              {[
                { icon: <Code2 />, label: "Computer Science", color: "text-blue-400", bg: "bg-blue-400/10" },
                { icon: <BrainCircuit />, label: "Mathematics", color: "text-purple-400", bg: "bg-purple-400/10" },
                { icon: <BookOpen />, label: "Language Arts", color: "text-emerald-400", bg: "bg-emerald-400/10" },
                { icon: <ShieldCheck />, label: "Science", color: "text-orange-400", bg: "bg-orange-400/10" },
              ].map((cat, i) => (
                <motion.button 
                  key={i}
                  variants={{
                    hidden: { opacity: 0, y: 20 },
                    show: { opacity: 1, y: 0 }
                  }}
                  whileHover={{ y: -5, scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleSearch(undefined, cat.label)}
                  className="p-6 rounded-2xl glass hover:bg-white/10 transition-all text-left space-y-3 group"
                >
                  <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110", cat.bg, cat.color)}>
                    {cat.icon}
                  </div>
                  <h3 className="font-bold">{cat.label}</h3>
                  <div className="flex items-center text-xs text-slate-500 gap-1">
                    Explore Quests <ChevronRight size={12} />
                  </div>
                </motion.button>
              ))}
            </motion.div>

            {/* Platform Features / How it Works */}
            <div className="grid md:grid-cols-3 gap-6">
              <div className="md:col-span-2 quest-card space-y-8">
                <div className="flex justify-between items-center">
                  <h3 className="text-xl font-bold flex items-center gap-2">
                    <Rocket className="text-primary" size={20} /> How EduQuest Works
                  </h3>
                  <span className="text-xs font-mono text-slate-500 uppercase tracking-widest">Example Platform</span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                      <Search size={20} />
                    </div>
                    <h4 className="font-bold text-sm">1. Search Topic</h4>
                    <p className="text-xs text-slate-400 leading-relaxed">Enter any subject you want to learn about. Our AI analyzes the core concepts instantly.</p>
                  </div>
                  <div className="space-y-3">
                    <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center text-secondary">
                      <BookOpen size={20} />
                    </div>
                    <h4 className="font-bold text-sm">2. AI Explanation</h4>
                    <p className="text-xs text-slate-400 leading-relaxed">Get a structured breakdown with visual aids and search-grounded sources for accuracy.</p>
                  </div>
                  <div className="space-y-3">
                    <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center text-accent">
                      <Gamepad2 size={20} />
                    </div>
                    <h4 className="font-bold text-sm">3. Master Quest</h4>
                    <p className="text-xs text-slate-400 leading-relaxed">Complete dynamic challenges—from quizzes to coding—to verify your understanding.</p>
                  </div>
                </div>

                <div className="pt-6 border-t border-white/5">
                  <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10">
                    <div className="flex items-center gap-3">
                      <ShieldCheck className="text-accent" size={20} />
                      <div>
                        <div className="text-sm font-bold">Verified Learning Path</div>
                        <div className="text-[10px] text-slate-500">Every quest is generated with educational best practices in mind.</div>
                      </div>
                    </div>
                    <button className="text-xs font-bold text-primary hover:underline">Learn More</button>
                  </div>
                </div>
              </div>

              <div className="quest-card bg-gradient-to-br from-primary/20 to-secondary/20 border-primary/20 flex flex-col justify-between">
                <div>
                  <h3 className="text-lg font-bold mb-2">Ready to Explore?</h3>
                  <p className="text-sm text-slate-300 mb-6">EduQuest uses advanced Gemini models to create personalized learning experiences in real-time.</p>
                </div>
                <div className="space-y-3">
                  <div className="p-4 rounded-xl bg-white/5 border border-white/10 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                      <BrainCircuit size={16} className="text-white" />
                    </div>
                    <div className="text-xs font-bold">Adaptive Difficulty</div>
                  </div>
                  <div className="p-4 rounded-xl bg-white/5 border border-white/10 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                      <Code2 size={16} className="text-white" />
                    </div>
                    <div className="text-xs font-bold">Multi-Modal Quests</div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Topic Explanation View */}
        <AnimatePresence mode="wait">
          {view === 'explanation' && topicExplanation && (
            <motion.div
              key="explanation"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="max-w-4xl mx-auto space-y-8"
            >
              <div className="quest-card overflow-hidden !p-0">
                <div className="aspect-video w-full relative group">
                  {animatedVideoUrl ? (
                    <video 
                      src={animatedVideoUrl} 
                      autoPlay 
                      loop 
                      muted 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <img 
                      src={topicExplanation.imageUrl} 
                      alt={searchQuery} 
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                      referrerPolicy="no-referrer"
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent opacity-60" />
                  <div className="absolute bottom-6 left-8 right-8 flex items-end justify-between">
                    <div>
                      <h2 className="text-4xl font-bold text-white drop-shadow-lg">{searchQuery}</h2>
                      <div className="flex items-center gap-2 text-xs text-slate-300 mt-2">
                        <ShieldCheck size={14} className="text-accent" /> Verified Educational Content
                      </div>
                    </div>
                    {!animatedVideoUrl && (
                      <button 
                        onClick={handleAnimate}
                        disabled={isAnimating}
                        className="p-3 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full text-white transition-all border border-white/20 group"
                      >
                        {isAnimating ? <Loader2 className="animate-spin" /> : <Play className="fill-white" />}
                        <span className="absolute -top-10 left-1/2 -translate-x-1/2 bg-black/80 text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">Animate with Veo</span>
                      </button>
                    )}
                  </div>
                </div>
                
                <div className="p-8 space-y-8">
                  <div className="grid md:grid-cols-3 gap-8">
                    <div className="md:col-span-2 space-y-6">
                      <div className="prose prose-invert max-w-none">
                        <div className="text-slate-300 text-lg leading-relaxed">
                          <Markdown>{topicExplanation.explanation}</Markdown>
                        </div>
                      </div>
                      
                      {topicExplanation.sources && topicExplanation.sources.length > 0 && (
                        <div className="pt-4 border-t border-white/5">
                          <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3 flex items-center gap-2">
                            <ExternalLink size={12} /> Search Grounding Sources
                          </h4>
                          <div className="flex flex-wrap gap-2">
                            {topicExplanation.sources.map((source: any, i: number) => (
                              <a 
                                key={i} 
                                href={source.web?.uri} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-[10px] px-2 py-1 rounded bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
                              >
                                {source.web?.title || "Source"}
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="space-y-4">
                      <div className="p-4 rounded-2xl bg-primary/5 border border-primary/10 space-y-3">
                        <h4 className="font-bold text-sm flex items-center gap-2">
                          <BrainCircuit size={16} className="text-primary" /> Learning Goals
                        </h4>
                        <ul className="text-xs text-slate-400 space-y-2">
                          <li className="flex items-center gap-2"><CheckCircle2 size={12} className="text-accent" /> Understand core principles</li>
                          <li className="flex items-center gap-2"><CheckCircle2 size={12} className="text-accent" /> Master key terminology</li>
                          <li className="flex items-center gap-2"><CheckCircle2 size={12} className="text-accent" /> Apply logic in quest</li>
                        </ul>
                      </div>
                      <div className="p-4 rounded-2xl bg-secondary/5 border border-secondary/10 space-y-3">
                        <h4 className="font-bold text-sm flex items-center gap-2">
                          <MapPin size={16} className="text-secondary" /> Contextual Data
                        </h4>
                        <p className="text-[10px] text-slate-500 italic">Maps grounding active for geographical context where applicable.</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-4 pt-4">
                    <button 
                      onClick={() => setView('home')}
                      className="px-8 py-4 bg-slate-800/50 hover:bg-slate-800 rounded-2xl font-bold transition-colors border border-white/5"
                    >
                      Back to Search
                    </button>
                    <button 
                      onClick={startQuest}
                      disabled={isGenerating}
                      className="flex-1 px-8 py-4 bg-primary hover:bg-primary/80 disabled:opacity-50 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all shadow-xl shadow-primary/20"
                    >
                      {isGenerating ? (
                        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
                          <Zap size={20} />
                        </motion.div>
                      ) : (
                        <>Begin Learning Quest <ArrowRight size={20} /></>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Active Quest View */}
        <AnimatePresence mode="wait">
          {view === 'quest' && activeQuest && (
            <motion.div 
              key="quest"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              className="max-w-3xl mx-auto"
            >
              <div className="quest-card relative overflow-hidden">
                {/* Quest Header */}
                <div className="flex items-start justify-between mb-8">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs font-bold text-primary uppercase tracking-widest">
                      <Gamepad2 size={14} /> Active Quest
                    </div>
                    <h2 className="text-3xl font-bold">{activeQuest.title}</h2>
                  </div>
                  <button 
                    onClick={() => setActiveQuest(null)}
                    className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                  >
                    <XCircle size={24} className="text-slate-500" />
                  </button>
                </div>

                {/* Quest Description */}
                <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800 mb-8">
                  <div className="text-slate-300 leading-relaxed italic">
                    <Markdown>{activeQuest.description}</Markdown>
                  </div>
                </div>

                {/* Game Content */}
                <div className="min-h-[400px]">
                  {activeQuest.type === QuestType.QUIZ && (
                    <QuizGame content={activeQuest.content} onComplete={completeQuest} />
                  )}
                  {activeQuest.type === QuestType.CODING_CHALLENGE && (
                    <CodingGame content={activeQuest.content} onComplete={completeQuest} />
                  )}
                  {activeQuest.type === QuestType.CONCEPT_MATCH && (
                    <ConceptMatchGame content={activeQuest.content} onComplete={completeQuest} />
                  )}
                  {activeQuest.type === QuestType.STORY_ADVENTURE && (
                    <StoryAdventureGame content={activeQuest.content} onComplete={completeQuest} />
                  )}
                  {activeQuest.type === QuestType.SHORT_ANSWER && (
                    <ShortAnswerGame content={activeQuest.content} onComplete={completeQuest} />
                  )}
                </div>

                {/* Footer Stats */}
                <div className="mt-12 pt-6 border-t border-white/5 flex items-center justify-between text-sm text-slate-500">
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1"><Trophy size={14} /> {activeQuest.points} XP Reward</span>
                    <span className="flex items-center gap-1"><ShieldCheck size={14} /> {activeQuest.difficulty}</span>
                  </div>
                  <span className="font-mono">Quest ID: {activeQuest.id}</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Success Overlay */}
      <AnimatePresence>
        {showSuccess && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm p-6"
          >
            <motion.div 
              initial={{ scale: 0.5, y: 50 }}
              animate={{ scale: 1, y: 0 }}
              className="quest-card max-w-sm w-full text-center space-y-6 py-12"
            >
              <div className="w-24 h-24 bg-accent rounded-full flex items-center justify-center mx-auto shadow-2xl shadow-accent/20">
                <Trophy size={48} className="text-white" />
              </div>
              <div className="space-y-2">
                <h2 className="text-3xl font-bold">Topic Mastered!</h2>
                <p className="text-slate-400">The learning quest has been successfully completed.</p>
              </div>
              <div className="text-4xl font-black text-accent">
                +{activeQuest?.points} XP
              </div>
              <div className="flex justify-center gap-2">
                {[...Array(5)].map((_, i) => (
                  <motion.div
                    key={i}
                    animate={{ y: [0, -10, 0] }}
                    transition={{ delay: i * 0.1, repeat: Infinity }}
                  >
                    <Star size={24} className="text-yellow-500" fill="currentColor" />
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ChatBot />
      <AnimatePresence>
        {showLiveAudio && <LiveAudioSession onClose={() => setShowLiveAudio(false)} />}
        {showImageGen && <ImageGenerator onClose={() => setShowImageGen(false)} />}
      </AnimatePresence>
      {/* Footer */}
      <footer className="p-8 text-center text-slate-600 text-xs border-t border-white/5">
        <p>© 2024 EduQuest Gamified Learning Platform. All rights reserved.</p>
        <p className="mt-2">Powered by Gemini AI for dynamic curriculum generation.</p>
      </footer>
    </div>
  );
}
