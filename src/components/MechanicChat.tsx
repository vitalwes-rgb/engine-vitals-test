import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { askMechanic } from '../services/geminiService';
import Markdown from 'react-markdown';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export default function MechanicChat() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: "Hi! I'm your AI Mechanic Assistant. You can ask me questions about repair quotes, symptoms, or general car advice. How can I help you today?"
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const history = messages.map(m => ({ role: m.role, content: m.content }));
      const response = await askMechanic(userMessage.content, history);
      
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response
      }]);
    } catch (error) {
      console.error('Error asking mechanic:', error);
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "I'm sorry, I encountered an error while trying to answer your question. Please try again."
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] md:h-[calc(100vh-80px)] bg-gradient-to-b from-[#1A1A1A] to-[#141414] border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
      <div className="p-6 border-b border-[#262626] bg-[#1A1A1A] flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
          <Bot className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">Ask AI Mechanic</h2>
          <p className="text-sm text-[#A3A3A3]">Get second opinions on quotes and repair advice</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 custom-scrollbar">
        <AnimatePresence initial={false}>
          {messages.map((message) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "flex gap-4 max-w-[85%]",
                message.role === 'user' ? "ml-auto flex-row-reverse" : ""
              )}
            >
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1",
                message.role === 'user' ? "bg-[#262626] text-white" : "bg-primary/20 text-primary"
              )}>
                {message.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>
              <div className={cn(
                "p-4 rounded-2xl",
                message.role === 'user' 
                  ? "bg-[#262626] text-white rounded-tr-sm" 
                  : "bg-[#1A1A1A] border border-[#262626] text-[#E5E5E5] rounded-tl-sm"
              )}>
                {message.role === 'user' ? (
                  <p className="whitespace-pre-wrap leading-relaxed text-sm">{message.content}</p>
                ) : (
                  <div className="markdown-body text-sm">
                    <Markdown>{message.content}</Markdown>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
          {isLoading && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex gap-4 max-w-[85%]"
            >
              <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center shrink-0 mt-1">
                <Bot className="w-4 h-4" />
              </div>
              <div className="p-4 rounded-2xl bg-[#1A1A1A] border border-[#262626] rounded-tl-sm flex items-center gap-2">
                <Loader2 className="w-4 h-4 text-primary animate-spin" />
                <span className="text-sm text-[#A3A3A3]">Analyzing...</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 bg-[#1A1A1A] border-t border-[#262626]">
        <form onSubmit={handleSubmit} className="relative flex items-center">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="E.g., Is $900 fair for front brake rotors and pads on a 2012 Ford Fusion?"
            className="w-full bg-[#0A0A0A] border border-[#262626] rounded-xl pl-4 pr-12 py-4 text-white placeholder-[#525252] focus:outline-none focus:border-primary/50 transition-colors"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="absolute right-2 p-2 bg-primary text-black rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
        <div className="mt-3 flex items-start gap-2 text-[10px] text-[#525252]">
          <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
          <p>AI advice is for informational purposes only. Always consult a certified mechanic before making repair decisions.</p>
        </div>
      </div>
    </div>
  );
}
