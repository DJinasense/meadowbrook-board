import React from 'react';
import {
  Globe,
  Users,
  Paperclip,
  Mail,
  Pencil,
  Archive,
  AlertTriangle,
  Info,
  Bell,
  CheckCircle,
  Phone,
  HelpCircle,
  ChevronRight,
} from 'lucide-react';
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

    PageHeader: {
      label: 'Sub-Page Header',
      fields: {
        title: { type: 'text', label: 'Page Title' },
        subtitle: { type: 'text', label: 'Subtitle / Description' },
        tag: { type: 'text', label: 'Tag / Badge' },
      },
      defaultProps: {
        title: 'Building Rules & Bylaws',
        subtitle: 'Community guidelines and policies for Building 7 residents.',
        tag: 'Building 7 Official',
      },
      render: ({ title, subtitle, tag }) => (
        <div className="text-center my-6 pb-4 border-b border-slate-200 dark:border-slate-800">
          {tag && (
            <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 uppercase tracking-wider mb-2">
              {tag}
            </span>
          )}
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-slate-100 mb-2">{title}</h1>
          {subtitle && (
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">{subtitle}</p>
          )}
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

    FaqAccordion: {
      label: 'FAQ / Rules Accordion',
      fields: {
        title: { type: 'text', label: 'Section Title' },
        item1Question: { type: 'text', label: 'Q1 Question' },
        item1Answer: { type: 'textarea', label: 'Q1 Answer' },
        item2Question: { type: 'text', label: 'Q2 Question' },
        item2Answer: { type: 'textarea', label: 'Q2 Answer' },
        item3Question: { type: 'text', label: 'Q3 Question' },
        item3Answer: { type: 'textarea', label: 'Q3 Answer' },
      },
      defaultProps: {
        title: 'Frequently Asked Questions & Guidelines',
        item1Question: 'Trash & Recycling Disposal',
        item1Answer: 'Trash chutes are on every floor. Please tie all bags securely. Large boxes and recyclables must be broken down and brought directly to the ground floor recycling room.',
        item2Question: 'Quiet Hours',
        item2Answer: 'Building quiet hours are 10:00 PM to 8:00 AM on weekdays, and 11:00 PM to 9:00 AM on weekends. Please be considerate of your neighbors.',
        item3Question: 'Move-in & Deliveries',
        item3Answer: 'Freight elevator reservations are required for large deliveries and move-in/move-out. Contact the superintendent at least 48 hours in advance.',
      },
      render: ({ title, item1Question, item1Answer, item2Question, item2Answer, item3Question, item3Answer }) => (
        <div className="my-6 text-left">
          {title && <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 mb-3">{title}</h3>}
          <div className="space-y-3">
            {item1Question && (
              <details className="group bg-white/90 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-xs">
                <summary className="flex items-center justify-between p-3.5 cursor-pointer font-semibold text-xs text-slate-800 dark:text-slate-200 hover:text-blue-600 select-none">
                  <span className="flex items-center gap-2">
                    <HelpCircle className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                    {item1Question}
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-open:rotate-90 transition-transform" />
                </summary>
                <div className="p-3.5 pt-0 text-xs text-slate-600 dark:text-slate-300 leading-relaxed border-t border-slate-100 dark:border-slate-700/60 mt-1 whitespace-pre-line">
                  {item1Answer}
                </div>
              </details>
            )}
            {item2Question && (
              <details className="group bg-white/90 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-xs">
                <summary className="flex items-center justify-between p-3.5 cursor-pointer font-semibold text-xs text-slate-800 dark:text-slate-200 hover:text-blue-600 select-none">
                  <span className="flex items-center gap-2">
                    <HelpCircle className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                    {item2Question}
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-open:rotate-90 transition-transform" />
                </summary>
                <div className="p-3.5 pt-0 text-xs text-slate-600 dark:text-slate-300 leading-relaxed border-t border-slate-100 dark:border-slate-700/60 mt-1 whitespace-pre-line">
                  {item2Answer}
                </div>
              </details>
            )}
            {item3Question && (
              <details className="group bg-white/90 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-xs">
                <summary className="flex items-center justify-between p-3.5 cursor-pointer font-semibold text-xs text-slate-800 dark:text-slate-200 hover:text-blue-600 select-none">
                  <span className="flex items-center gap-2">
                    <HelpCircle className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                    {item3Question}
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-open:rotate-90 transition-transform" />
                </summary>
                <div className="p-3.5 pt-0 text-xs text-slate-600 dark:text-slate-300 leading-relaxed border-t border-slate-100 dark:border-slate-700/60 mt-1 whitespace-pre-line">
                  {item3Answer}
                </div>
              </details>
            )}
          </div>
        </div>
      ),
    },

    ResourceContacts: {
      label: 'Contacts & Resources Directory',
      fields: {
        title: { type: 'text', label: 'Section Title' },
        c1Name: { type: 'text', label: 'Contact 1 Name/Role' },
        c1Phone: { type: 'text', label: 'Contact 1 Phone' },
        c1Note: { type: 'text', label: 'Contact 1 Hours/Note' },
        c2Name: { type: 'text', label: 'Contact 2 Name/Role' },
        c2Phone: { type: 'text', label: 'Contact 2 Phone' },
        c2Note: { type: 'text', label: 'Contact 2 Hours/Note' },
        c3Name: { type: 'text', label: 'Contact 3 Name/Role' },
        c3Phone: { type: 'text', label: 'Contact 3 Phone' },
        c3Note: { type: 'text', label: 'Contact 3 Hours/Note' },
      },
      defaultProps: {
        title: 'Building Contacts & Emergency Directory',
        c1Name: 'Superintendent Office',
        c1Phone: '(555) 019-2834',
        c1Note: 'Mon-Fri 8am - 4pm (Apt 101)',
        c2Name: 'Property Management Desk',
        c2Phone: '(555) 012-4920',
        c2Note: 'Billing, leases, general inquiries',
        c3Name: 'Emergency Maintenance (24/7)',
        c3Phone: '(555) 019-9999',
        c3Note: 'Water leaks, lockouts, heat emergencies',
      },
      render: ({ title, c1Name, c1Phone, c1Note, c2Name, c2Phone, c2Note, c3Name, c3Phone, c3Note }) => (
        <div className="my-6 text-left">
          {title && <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 mb-3">{title}</h3>}
          <div className="grid grid-cols-1 gap-2.5">
            {c1Name && (
              <div className="p-3.5 rounded-xl bg-white/90 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 flex items-center justify-between shadow-xs">
                <div>
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-100">{c1Name}</p>
                  {c1Note && <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">{c1Note}</p>}
                </div>
                {c1Phone && (
                  <a
                    href={`tel:${c1Phone.replace(/[^\d+]/g, '')}`}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-semibold text-xs hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                  >
                    <Phone className="w-3.5 h-3.5" /> {c1Phone}
                  </a>
                )}
              </div>
            )}
            {c2Name && (
              <div className="p-3.5 rounded-xl bg-white/90 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 flex items-center justify-between shadow-xs">
                <div>
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-100">{c2Name}</p>
                  {c2Note && <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">{c2Note}</p>}
                </div>
                {c2Phone && (
                  <a
                    href={`tel:${c2Phone.replace(/[^\d+]/g, '')}`}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-semibold text-xs hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                  >
                    <Phone className="w-3.5 h-3.5" /> {c2Phone}
                  </a>
                )}
              </div>
            )}
            {c3Name && (
              <div className="p-3.5 rounded-xl bg-white/90 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 flex items-center justify-between shadow-xs">
                <div>
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-100">{c3Name}</p>
                  {c3Note && <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">{c3Note}</p>}
                </div>
                {c3Phone && (
                  <a
                    href={`tel:${c3Phone.replace(/[^\d+]/g, '')}`}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 font-semibold text-xs hover:bg-rose-100 dark:hover:bg-rose-900/50 transition-colors"
                  >
                    <Phone className="w-3.5 h-3.5" /> {c3Phone}
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      ),
    },

    RichText: {
      label: 'Rich Text Block',
      fields: {
        content: { type: 'textarea', label: 'Text Content' },
        align: {
          type: 'select',
          label: 'Alignment',
          options: [
            { label: 'Left', value: 'left' },
            { label: 'Center', value: 'center' },
          ],
        },
      },
      defaultProps: {
        content: 'Welcome to our neighbor-run building platform. Have a question or announcement? Share it with the community.',
        align: 'left',
      },
      render: ({ content, align }) => (
        <div className={`my-4 ${align === 'center' ? 'text-center' : 'text-left'}`}>
          <div className="p-4 rounded-xl bg-white/70 dark:bg-slate-800/70 border border-slate-100 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line shadow-xs">
            {content}
          </div>
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

export const DEFAULT_RULES_PUCK_DATA = {
  content: [
    {
      type: 'PageHeader',
      props: {
        id: 'hdr-1',
        title: 'Building 7 Rules & Guidelines',
        subtitle: 'Official community standards for quiet hours, trash disposal, and shared spaces.',
        tag: 'Building 7 Guidelines',
      },
    },
    {
      type: 'FaqAccordion',
      props: {
        id: 'faq-1',
        title: 'Resident Guidelines & Common Procedures',
        item1Question: 'Trash Chutes & Recycling Regulations',
        item1Answer: 'Trash chutes operate 7:00 AM - 10:00 PM. All household waste must be tied in heavy-duty plastic bags. Never drop pizza boxes or cardboard down chutes; place broken-down boxes in the ground floor recycling room.',
        item2Question: 'Building Quiet Hours',
        item2Answer: 'Quiet hours are observed 10:00 PM to 8:00 AM on weekdays, and 11:00 PM to 9:00 AM on weekends and holidays. Please keep television and stereo volumes considerate.',
        item3Question: 'Move-in & Large Deliveries',
        item3Answer: 'Freight elevator reservations must be scheduled with building management at least 48 hours in advance. Moving hours are Monday through Friday, 9:00 AM to 4:00 PM only.',
      },
    },
    {
      type: 'NoticeBanner',
      props: {
        id: 'notice-1',
        title: 'Hallway & Common Area Fire Code',
        message: 'Per local fire regulations, all doormats, shoes, bicycles, and personal items must be kept inside your apartment. Hallways and stairwells must remain clear at all times.',
        variant: 'warning',
      },
    },
    {
      type: 'Footer',
      props: {
        id: 'footer-1',
        text: 'MeadowBrook Building 7 · Courtesy, Community, and Safety',
      },
    },
  ],
  root: {
    props: {
      title: 'Building Rules · MeadowBrook Building 7',
    },
  },
};

export const DEFAULT_RESOURCES_PUCK_DATA = {
  content: [
    {
      type: 'PageHeader',
      props: {
        id: 'hdr-res',
        title: 'Building Contacts & Resources',
        subtitle: 'Key telephone numbers, maintenance contacts, and emergency assistance.',
        tag: 'Building 7 Resources',
      },
    },
    {
      type: 'ResourceContacts',
      props: {
        id: 'contacts-1',
        title: 'Essential Directory',
        c1Name: 'Building Superintendent',
        c1Phone: '(555) 019-2834',
        c1Note: 'Mon-Fri 8:00 AM - 4:00 PM · Apt 101',
        c2Name: 'Property Management Office',
        c2Phone: '(555) 012-4920',
        c2Note: 'Billing, maintenance requests, elevator bookings',
        c3Name: '24/7 Emergency Dispatch',
        c3Phone: '(555) 019-9999',
        c3Note: 'Water pipe leaks, electrical faults, lockouts',
      },
    },
    {
      type: 'NoticeBanner',
      props: {
        id: 'notice-emerg',
        title: 'In Case of Life Safety Emergencies',
        message: 'For fire, medical, or police emergencies, dial 911 immediately before notifying building staff.',
        variant: 'urgent',
      },
    },
    {
      type: 'Footer',
      props: {
        id: 'footer-res',
        text: 'MeadowBrook Building 7 · Quick Assistance Directory',
      },
    },
  ],
  root: {
    props: {
      title: 'Resources & Contacts · MeadowBrook Building 7',
    },
  },
};

export const SITE_PAGE_DEFAULTS = {
  landing: DEFAULT_LANDING_PUCK_DATA,
  rules: DEFAULT_RULES_PUCK_DATA,
  resources: DEFAULT_RESOURCES_PUCK_DATA,
};
