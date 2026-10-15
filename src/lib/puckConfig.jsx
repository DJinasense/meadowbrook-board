import React from 'react';
import { Globe, Users, Paperclip, Mail, Pencil, Archive, AlertTriangle, Info, Bell, CheckCircle } from 'lucide-react';
import { navigate } from './router';

export const puckConfig = {
  components: {
    Hero: {
      label: 'Landing Hero Header',
      fields: {
        title: { type: 'text', label: 'Title' },
        line1: { type: 'text', label: 'Manifesto Line 1' },
        line2: { type: 'text', label: 'Manifesto Line 2' },
        line3: { type: 'text', label: 'Manifesto Line 3' },
        showLogo: {
          type: 'select',
          label: 'Show Logo',
          options: [
            { label: 'Yes', value: 'yes' },
            { label: 'No', value: 'no' },
          ],
        },
      },
      defaultProps: {
        title: 'MeadowBrook · Building 7',
        line1: 'Neighborly built, hosted, and maintained — Community Board.',
        line2: 'Fueled by transparency, authenticity, anonymity, if need be.',
        line3: 'Our Build. Your Voice.',
        showLogo: 'yes',
      },
      render: ({ title, line1, line2, line3, showLogo }) => (
        <div className="text-center my-6">
          {showLogo !== 'no' && (
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 mb-6 p-3.5 shadow-xl shadow-slate-200/50 dark:shadow-none">
              <img src="/logo-icon.png" alt="Logo" className="w-full h-full object-contain dark:hidden" />
              <img src="/logo-icon-white.png" alt="Logo" className="w-full h-full object-contain hidden dark:block" />
            </div>
          )}
          <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100 mb-2">{title}</h1>
          <p
            className="text-base text-slate-500 dark:text-slate-400 mb-8 text-center italic leading-relaxed"
            style={{ fontFamily: "'Lora', Georgia, serif" }}
          >
            {line1 && <span className="block">{line1}</span>}
            {line2 && <span className="block">{line2}</span>}
            {line3 && <span className="block font-semibold">{line3}</span>}
          </p>
        </div>
      ),
    },

    GeneralBoardCard: {
      label: 'General Board Card',
      fields: {
        title: { type: 'text', label: 'Title' },
        line1: { type: 'text', label: 'Line 1' },
        line2: { type: 'text', label: 'Line 2' },
        line3: { type: 'text', label: 'Line 3' },
        line4: { type: 'text', label: 'Line 4' },
        buttonText: { type: 'text', label: 'Button Text' },
      },
      defaultProps: {
        title: 'General Board',
        line1: 'Open to neighbors. Start a thread, read a thread, join in a conversation.',
        line2: 'See something, say something.',
        line3: 'No account required.',
        line4: 'Post with name, unit number, or anonymously.',
        buttonText: 'Enter the General Board',
      },
      render: ({ title, line1, line2, line3, line4, buttonText }) => (
        <div className="bg-white/90 dark:bg-slate-800/90 border border-slate-100 dark:border-slate-700 rounded-2xl shadow-sm p-6 my-4 text-left">
          <div className="flex items-center gap-2 mb-2">
            <Globe className="w-5 h-5 text-blue-700 dark:text-blue-400" />
            <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">{title}</h2>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-4 text-center">
            {line1 && <span className="block">{line1}</span>}
            {line2 && <span className="block">{line2}</span>}
            {line3 && <span className="block">{line3}</span>}
            {line4 && <span className="block">{line4}</span>}
          </p>
          <button
            type="button"
            onClick={() => navigate('board')}
            className="w-full bg-blue-700 text-white py-3 rounded-xl font-semibold hover:bg-blue-800 transition-colors shadow-md shadow-blue-100 dark:shadow-none cursor-pointer"
          >
            {buttonText || 'Enter the General Board'}
          </button>
        </div>
      ),
    },

    MembersBoardCard: {
      label: 'Members Board Card',
      fields: {
        title: { type: 'text', label: 'Title' },
        intro: { type: 'text', label: 'Intro' },
        postingNote: { type: 'text', label: 'Posting Note' },
        showFeatures: {
          type: 'select',
          label: 'Show Feature Bullets',
          options: [
            { label: 'Yes', value: 'yes' },
            { label: 'No', value: 'no' },
          ],
        },
        buttonText: { type: 'text', label: 'Button Text' },
      },
      defaultProps: {
        title: 'Members Board',
        intro: 'Register as a Building 7 resident. Sign up with your unit number to get in.',
        postingNote: 'Members can post under their name, unit #, or anonymously.',
        showFeatures: 'yes',
        buttonText: 'Enter the Members Board',
      },
      render: ({ title, intro, postingNote, showFeatures, buttonText }) => (
        <div className="bg-white/90 dark:bg-slate-800/90 border border-emerald-200 dark:border-emerald-800/60 rounded-2xl shadow-sm p-6 my-4 text-left">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
            <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">{title}</h2>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-3">
            {intro}
          </p>
          {showFeatures !== 'no' && (
            <ul className="text-sm text-slate-600 dark:text-slate-300 space-y-1.5 mb-3">
              <li className="flex gap-2">
                <Paperclip className="w-4 h-4 mt-0.5 text-emerald-700 dark:text-emerald-400 shrink-0" />
                Upload photos, PDFs, and documents
              </li>
              <li className="flex gap-2">
                <Mail className="w-4 h-4 mt-0.5 text-emerald-700 dark:text-emerald-400 shrink-0" />
                Private messages to other members
              </li>
              <li className="flex gap-2">
                <Pencil className="w-4 h-4 mt-0.5 text-emerald-700 dark:text-emerald-400 shrink-0" />
                Edit or delete your own posts
              </li>
              <li className="flex gap-2">
                <Archive className="w-4 h-4 mt-0.5 text-emerald-700 dark:text-emerald-400 shrink-0" />
                Archives: previous budget proposals, current budgeting info, applicable letters, anything and everything.
              </li>
            </ul>
          )}
          {postingNote && (
            <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-100 dark:border-emerald-800/60 rounded-lg px-3 py-2 mb-4">
              {postingNote}
            </p>
          )}
          <button
            type="button"
            onClick={() => navigate('members')}
            className="w-full bg-emerald-600 text-white py-3 rounded-xl font-semibold hover:bg-emerald-700 transition-colors shadow-sm cursor-pointer"
          >
            {buttonText || 'Enter the Members Board'}
          </button>
        </div>
      ),
    },

    NoticeBanner: {
      label: 'Notice Banner',
      fields: {
        title: { type: 'text', label: 'Banner Title' },
        message: { type: 'textarea', label: 'Notice Message' },
        variant: {
          type: 'select',
          label: 'Banner Type',
          options: [
            { label: 'Urgent Alert (Red)', value: 'urgent' },
            { label: 'Information (Blue)', value: 'info' },
            { label: 'Warning (Amber)', value: 'warning' },
            { label: 'Success / Notice (Green)', value: 'success' },
          ],
        },
      },
      defaultProps: {
        title: 'Building Notice',
        message: 'Elevator maintenance scheduled for Building 7 tomorrow from 10:00 AM to 1:00 PM.',
        variant: 'info',
      },
      render: ({ title, message, variant }) => {
        const styles = {
          urgent: 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900 text-red-900 dark:text-red-200',
          info: 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-900 text-blue-900 dark:text-blue-200',
          warning: 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900 text-amber-900 dark:text-amber-200',
          success: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900 text-emerald-900 dark:text-emerald-200',
        };
        const icons = {
          urgent: <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />,
          info: <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />,
          warning: <Bell className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />,
          success: <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />,
        };
        return (
          <div className={`p-4 rounded-xl border my-4 text-left ${styles[variant] || styles.info}`}>
            <div className="flex items-start gap-3">
              {icons[variant] || icons.info}
              <div>
                {title && <h3 className="text-sm font-bold mb-1">{title}</h3>}
                <p className="text-xs leading-relaxed whitespace-pre-line">{message}</p>
              </div>
            </div>
          </div>
        );
      },
    },

    RichText: {
      label: 'Rich Text Block',
      fields: {
        content: { type: 'textarea', label: 'Text Content' },
        align: {
          type: 'select',
          label: 'Alignment',
          options: [
            { label: 'Center', value: 'center' },
            { label: 'Left', value: 'left' },
          ],
        },
      },
      defaultProps: {
        content: 'Welcome to our neighbor-run building platform. Have a question or announcement? Share it with the community.',
        align: 'center',
      },
      render: ({ content, align }) => (
        <div className={`my-4 ${align === 'left' ? 'text-left' : 'text-center'}`}>
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">
            {content}
          </p>
        </div>
      ),
    },

    Footer: {
      label: 'Footer Line',
      fields: {
        text: { type: 'text', label: 'Footer Text' },
      },
      defaultProps: {
        text: 'Building 7 · If you see something, say something',
      },
      render: ({ text }) => (
        <p className="text-xs text-slate-300 dark:text-slate-600 my-8 text-center">
          {text}
        </p>
      ),
    },
  },
};

export const DEFAULT_LANDING_PUCK_DATA = {
  content: [
    {
      type: 'Hero',
      props: {
        id: 'hero-1',
        title: 'MeadowBrook · Building 7',
        line1: 'Neighborly built, hosted, and maintained — Community Board.',
        line2: 'Fueled by transparency, authenticity, anonymity, if need be.',
        line3: 'Our Build. Your Voice.',
        showLogo: 'yes',
      },
    },
    {
      type: 'GeneralBoardCard',
      props: {
        id: 'general-1',
        title: 'General Board',
        line1: 'Open to neighbors. Start a thread, read a thread, join in a conversation.',
        line2: 'See something, say something.',
        line3: 'No account required.',
        line4: 'Post with name, unit number, or anonymously.',
        buttonText: 'Enter the General Board',
      },
    },
    {
      type: 'MembersBoardCard',
      props: {
        id: 'members-1',
        title: 'Members Board',
        intro: 'Register as a Building 7 resident. Sign up with your unit number to get in.',
        postingNote: 'Members can post under their name, unit #, or anonymously.',
        showFeatures: 'yes',
        buttonText: 'Enter the Members Board',
      },
    },
    {
      type: 'Footer',
      props: {
        id: 'footer-1',
        text: 'Building 7 · If you see something, say something',
      },
    },
  ],
  root: {
    props: {
      title: 'MeadowBrook · Building 7',
    },
  },
};
