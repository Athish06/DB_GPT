import React, { useState, useEffect, useCallback } from 'react';
import { Database, Lightbulb, MessageSquare, Sliders, PlayCircle, X } from 'lucide-react';

interface IntroModalProps {
  onClose: () => void;
}

const IntroModal: React.FC<IntroModalProps> = ({ onClose }) => {
  const fullTitle = 'Database AI Assistant';
  const [displayedTitle, setDisplayedTitle] = useState('');
  const [isTypingComplete, setIsTypingComplete] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    let i = 0;
    const typingInterval = setInterval(() => {
      setDisplayedTitle(fullTitle.substring(0, i));
      i++;
      if (i > fullTitle.length) {
        clearInterval(typingInterval);
        setIsTypingComplete(true);
      }
    }, 100); // Typing speed

    return () => clearInterval(typingInterval);
  }, [fullTitle]);

  const handleGetStarted = useCallback(() => {
    setIsExiting(true);
    setTimeout(() => {
      onClose();
    }, 500); // Duration of the exit animation
  }, [onClose]);

  const featureCards = [
    {
      icon: <Database className="h-8 w-8 text-blue-400" />,
      title: 'Seamless Database Connection',
      description: 'Effortlessly connect to your PostgreSQL databases with secure credentials. Manage multiple database connections in one place.'
    },
    {
      icon: <Lightbulb className="h-8 w-8 text-yellow-400" />,
      title: 'AI-Powered SQL Generation',
      description: 'Leverage the power of AI to convert natural language questions into executable SQL queries. Interact with your data using simple sentences.'
    },
    {
      icon: <MessageSquare className="h-8 w-8 text-green-400" />,
      title: 'Interactive Chat Assistant',
      description: 'Get instant explanations and insights for the generated SQL. Understand your data better with a conversational AI interface.'
    },
    {
      icon: <Sliders className="h-8 w-8 text-purple-400" />,
      title: 'Intuitive Data Management',
      description: 'View, query, and manage your database tables with ease. The integrated TableViewer provides a clear overview of your data.'
    },
    {
      icon: <PlayCircle className="h-8 w-8 text-red-400" />,
      title: 'Streamlined Data Entry',
      description: 'Utilize the integrated DataForm to add new records to your tables. Simplify data population with a user-friendly interface.'
    }
  ];

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-gray-900 bg-opacity-95 backdrop-blur-sm
                  transition-transform duration-500 ease-in-out ${isExiting ? '-translate-y-full' : 'translate-y-0'}`}
    >
      <div
        className="bg-gray-800 rounded-xl shadow-2xl p-8 max-w-4xl w-full mx-4 border border-gray-700
                   transform transition-transform duration-500 ease-in-out scale-95 opacity-0
                   sm:scale-100 sm:opacity-100"
        style={{ animation: 'scaleIn 0.5s forwards' }} // Simple fade-in and scale-in for the modal content
      >
        <button
          onClick={handleGetStarted} // Use handleGetStarted for closing
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors focus:outline-none"
          aria-label="Close Intro"
        >
          <X className="h-6 w-6" />
        </button>

        <h1 className="text-4xl font-extrabold text-blue-500 mb-6 text-center">
          {displayedTitle}
          {isTypingComplete && (
            <span className="animate-blink inline-block w-1 h-8 bg-blue-500 ml-1 rounded"></span>
          )}
        </h1>

        <p className="text-lg text-gray-300 mb-8 text-center max-w-2xl mx-auto">
          Welcome to your all-in-one platform for effortless database management and intelligent data interaction.
          Harness the power of AI to simplify your workflow and gain deeper insights from your data.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
          {featureCards.map((card, index) => (
            <div key={index} className="flex items-start bg-gray-700 p-4 rounded-lg shadow-md">
              <div className="flex-shrink-0 mr-4 mt-1">
                {card.icon}
              </div>
              <div>
                <h4 className="font-semibold text-white text-lg mb-1">{card.title}</h4>
                <p className="text-gray-300 text-sm">{card.description}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center">
          <button
            onClick={handleGetStarted}
            className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-xl
                       transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-800"
          >
            Get Started
          </button>
        </div>
      </div>

      {/* Define keyframe animation for typing cursor and modal entry */}
      <style>
        {`
        @keyframes blink {
          50% { opacity: 0; }
        }
        .animate-blink {
          animation: blink 0.7s infinite step-end;
        }

        @keyframes scaleIn {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        `}
      </style>
    </div>
  );
};

export default IntroModal;
