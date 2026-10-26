import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Bot, Sparkles, X, Send, ArrowRight, Minimize2,
    Maximize2, HelpCircle, RefreshCw, CheckCircle2
} from 'lucide-react';
import aiService from '../../services/aiService';

const quickPrompts = [
    { label: 'EPF Rules & Due Dates', query: 'What are the EPF provident fund rules and monthly deadline?' },
    { label: 'ESIC Eligibility & Rates', query: 'What are the ESIC rules, wage limits and contribution rates?' },
    { label: 'Salary Proration Formula', query: 'How is monthly salary and proration calculated?' },
    { label: 'Leave Policy & Balance', query: 'What are the rules for Casual, Sick and Earned leave?' },
    { label: 'GPS Attendance Punching', query: 'How does GPS mobile attendance punching work?' },
    { label: 'Client 194C TDS', query: 'What is Section 194C TDS deduction on contractor invoices?' },
    { label: 'Uniform & Asset Policy', query: 'How are Uniforms, Helmets and IT assets tracked and issued?' }
];

const AIChatbotWidget = () => {
    const navigate = useNavigate();
    const [isOpen, setIsOpen] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [messages, setMessages] = useState([
        {
            sender: 'bot',
            text: "👋 **Namaste! I am the NKD CRM AI Assistant.**\n\nI can answer questions regarding:\n• **Attendance & GPS Punching**\n• **Leave & Holidays**\n• **Payroll, PF & ESIC Rules**\n• **Client Invoices & 194C TDS**\n• **Asset Allocation & Vendors**\n\nHow can I help you today?",
            suggestedActions: [
                { label: 'Attendance', link: '/attendance' },
                { label: 'Leaves', link: '/leaves' },
                { label: 'Payroll', link: '/payroll' }
            ]
        }
    ]);

    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        if (isOpen && !isMinimized) {
            scrollToBottom();
        }
    }, [messages, isOpen, isMinimized]);

    const handleSend = async (messageText = null) => {
        const textToSend = (messageText || input).trim();
        if (!textToSend || loading) return;

        const newMessages = [...messages, { sender: 'user', text: textToSend }];
        setMessages(newMessages);
        setInput('');
        setLoading(true);

        try {
            const res = await aiService.chat(textToSend);
            const botData = res.data?.data || res.data || {};
            setMessages([
                ...newMessages,
                {
                    sender: 'bot',
                    text: botData.reply || 'I could not process that request. Please try asking about PF, ESIC, Leave or Payroll.',
                    suggestedActions: botData.suggestedActions || []
                }
            ]);
        } catch (err) {
            setMessages([
                ...newMessages,
                {
                    sender: 'bot',
                    text: '⚠️ Unable to connect to AI engine. Please verify backend connection.',
                    suggestedActions: []
                }
            ]);
        } finally {
            setLoading(false);
        }
    };

    const formatMessageText = (text) => {
        if (!text) return '';
        const lines = text.split('\n');
        return lines.map((line, idx) => {
            // Replace bold **text**
            const parts = line.split(/(\*\*.*?\*\*)/g);
            return (
                <div key={idx} className={line.startsWith('•') || line.startsWith('-') ? 'ml-2 my-0.5' : 'my-0.5'}>
                    {parts.map((p, pIdx) => {
                        if (p.startsWith('**') && p.endsWith('**')) {
                            return <strong key={pIdx} className="font-semibold text-slate-900">{p.slice(2, -2)}</strong>;
                        }
                        if (p.startsWith('`') && p.endsWith('`')) {
                            return <code key={pIdx} className="bg-slate-100 text-primary-700 px-1 py-0.5 rounded text-xs">{p.slice(1, -1)}</code>;
                        }
                        return p;
                    })}
                </div>
            );
        });
    };

    return (
        <div className="fixed bottom-6 right-6 z-50 font-sans">
            {/* Floating Trigger Button */}
            {!isOpen && (
                <button
                    onClick={() => { setIsOpen(true); setIsMinimized(false); }}
                    className="relative group flex items-center gap-2 bg-gradient-to-r from-primary-600 to-indigo-600 text-white p-3.5 rounded-full shadow-xl hover:shadow-2xl hover:scale-105 active:scale-95 transition-all duration-300"
                    title="NKD AI Assistant"
                >
                    <div className="relative">
                        <Sparkles className="w-6 h-6 animate-pulse" />
                        <span className="absolute -top-1 -right-1 flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                        </span>
                    </div>
                    <span className="hidden group-hover:inline-block pr-2 text-sm font-semibold tracking-wide">
                        Ask AI Assistant
                    </span>
                </button>
            )}

            {/* Chat Box Window */}
            {isOpen && (
                <div
                    className={`bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col transition-all duration-300 ${
                        isMinimized ? 'w-80 h-14' : 'w-96 max-w-[calc(100vw-2rem)] h-[540px]'
                    }`}
                >
                    {/* Header */}
                    <div className="bg-gradient-to-r from-primary-600 to-indigo-700 text-white px-4 py-3 flex items-center justify-between select-none">
                        <div className="flex items-center gap-2.5">
                            <div className="p-1.5 bg-white/20 rounded-lg backdrop-blur-sm">
                                <Bot className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-sm leading-tight flex items-center gap-1.5">
                                    NKD AI Assistant
                                    <span className="text-[10px] bg-emerald-500 text-white font-medium px-1.5 py-0.2 rounded-full">
                                        Online
                                    </span>
                                </h3>
                                <p className="text-[11px] text-white/80 leading-tight">HR, Compliance & Payroll Engine</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => setIsMinimized(!isMinimized)}
                                className="p-1 hover:bg-white/20 rounded text-white/90 hover:text-white transition-colors"
                                title={isMinimized ? 'Expand' : 'Minimize'}
                            >
                                {isMinimized ? <Maximize2 size={16} /> : <Minimize2 size={16} />}
                            </button>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="p-1 hover:bg-white/20 rounded text-white/90 hover:text-white transition-colors"
                                title="Close"
                            >
                                <X size={16} />
                            </button>
                        </div>
                    </div>

                    {!isMinimized && (
                        <>
                            {/* Quick Prompts Bar */}
                            <div className="px-3 py-2 bg-slate-50 border-b border-slate-100 flex items-center gap-1.5 overflow-x-auto text-xs no-scrollbar">
                                <span className="text-slate-400 font-medium whitespace-nowrap pl-1">Ask:</span>
                                {quickPrompts.map((p, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => handleSend(p.query)}
                                        className="whitespace-nowrap px-2.5 py-1 bg-white border border-slate-200 hover:border-primary-400 hover:text-primary-700 hover:bg-primary-50 rounded-full text-slate-600 transition-colors shadow-2xs font-medium"
                                    >
                                        {p.label}
                                    </button>
                                ))}
                            </div>

                            {/* Messages Container */}
                            <div className="flex-1 p-4 overflow-y-auto space-y-3.5 bg-slate-50/50">
                                {messages.map((m, idx) => (
                                    <div
                                        key={idx}
                                        className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}
                                    >
                                        <div
                                            className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed shadow-xs ${
                                                m.sender === 'user'
                                                    ? 'bg-primary-600 text-white rounded-br-xs'
                                                    : 'bg-white border border-slate-200 text-slate-700 rounded-bl-xs'
                                            }`}
                                        >
                                            {formatMessageText(m.text)}
                                        </div>

                                        {/* Suggested action buttons in bot reply */}
                                        {m.suggestedActions && m.suggestedActions.length > 0 && (
                                            <div className="flex flex-wrap gap-1.5 mt-2 ml-1">
                                                {m.suggestedActions.map((act, actIdx) => (
                                                    <button
                                                        key={actIdx}
                                                        onClick={() => {
                                                            navigate(act.link);
                                                            setIsMinimized(true);
                                                        }}
                                                        className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 bg-primary-50 text-primary-700 border border-primary-200 rounded-md hover:bg-primary-100 transition-colors"
                                                    >
                                                        {act.label}
                                                        <ArrowRight size={10} />
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}

                                {loading && (
                                    <div className="flex items-center gap-2 text-xs text-slate-500 bg-white border border-slate-200 px-3 py-2 rounded-2xl w-fit rounded-bl-xs shadow-xs">
                                        <RefreshCw size={12} className="animate-spin text-primary-600" />
                                        <span>AI is thinking...</span>
                                    </div>
                                )}
                                <div ref={messagesEndRef} />
                            </div>

                            {/* Chat Input */}
                            <form
                                onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                                className="p-3 bg-white border-t border-slate-200 flex items-center gap-2"
                            >
                                <input
                                    type="text"
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    placeholder="Type your question (PF, Leaves, Payslip...)"
                                    className="flex-1 text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 text-slate-800 placeholder-slate-400"
                                />
                                <button
                                    type="submit"
                                    disabled={!input.trim() || loading}
                                    className="p-2.5 bg-primary-600 hover:bg-primary-700 disabled:opacity-40 text-white rounded-xl shadow-xs transition-colors"
                                >
                                    <Send size={14} />
                                </button>
                            </form>
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

export default AIChatbotWidget;
