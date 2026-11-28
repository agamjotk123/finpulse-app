'use client'; // this page has a form with buttons and state, so it runs in the browser

// FEEDBACK PAGE (benfora.vercel.app/feedback)
// Visitors pick a type, give a rating, write a message and press Send.
// The message is emailed to the owner through Web3Forms (a free form-to-email service),
// so Benfora doesn't need its own server or database.
//
// SETUP: the Web3Forms access key goes in Vercel > Settings > Environment Variables
// as NEXT_PUBLIC_WEB3FORMS_KEY. Without it, the page falls back to opening the
// visitor's email app (if SITE.contactEmail is set), or shows a "not set up" note.

import { useState } from 'react';
import { SubPageShell } from '@/components/SubPageShell'; // shared header, nav and footer
import { SITE } from '@/lib/site'; // site name and contact email
import { track } from '@/lib/analytics'; // anonymous usage counting (never the message itself)

// The access key Web3Forms gives you. It's designed to be public, so it's safe in browser code.
const WEB3FORMS_KEY = process.env.NEXT_PUBLIC_WEB3FORMS_KEY ?? '';
const WEB3FORMS_URL = 'https://api.web3forms.com/submit'; // where the form is sent

// The kinds of feedback a visitor can choose. "id" is what we store; "label" is what they see.
const TYPES = [
  { id: 'bug', label: 'Something’s wrong', emoji: '🐞' },
  { id: 'idea', label: 'Feature idea', emoji: '💡' },
  { id: 'question', label: 'Question', emoji: '❓' },
  { id: 'praise', label: 'I like it', emoji: '👍' },
] as const;
type FeedbackType = (typeof TYPES)[number]['id'];

// The 1-5 rating options, shown as faces from unhappy to delighted.
const RATINGS = [
  { value: 1, face: '😞', label: 'Very poor' },
  { value: 2, face: '🙁', label: 'Poor' },
  { value: 3, face: '😐', label: 'Okay' },
  { value: 4, face: '🙂', label: 'Good' },
  { value: 5, face: '😍', label: 'Love it' },
];

const MIN_MESSAGE = 10; // shortest message we accept, to avoid empty "hi" submissions
const MAX_MESSAGE = 2000; // longest message, to keep emails readable

// Shared styling for the text boxes, so they all look the same.
const field =
  'mt-2 w-full rounded-xl border border-graphite bg-transparent px-4 py-3 text-paper placeholder:text-haze focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pulse';

type Status = 'idle' | 'sending' | 'sent' | 'error'; // where the form is in its life

export default function FeedbackPage() {
  // ---- what the visitor has entered so far ----
  const [type, setType] = useState<FeedbackType>('idea');
  const [rating, setRating] = useState<number | null>(null); // null = not rated (rating is optional)
  const [message, setMessage] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState(''); // optional: only if they want a reply
  const [botcheck, setBotcheck] = useState(false); // hidden "honeypot" box: real people never tick it, spam bots do
  const [status, setStatus] = useState<Status>('idle');

  const canUseWeb3Forms = WEB3FORMS_KEY.length > 0; // is the form connected to email delivery?
  const canUseEmailApp = !!SITE.contactEmail; // backup: open the visitor's own email app
  const ready = canUseWeb3Forms || canUseEmailApp; // if neither, we show a "not set up" note
  const tooShort = message.trim().length < MIN_MESSAGE;
  const typeLabel = TYPES.find((t) => t.id === type)?.label ?? type;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault(); // stop the browser reloading the page
    if (tooShort || status === 'sending') return;
    if (botcheck) return setStatus('sent'); // a bot filled the hidden box: pretend it worked, send nothing

    const subject = `${SITE.name} feedback: ${typeLabel}${rating ? ` (${rating}/5)` : ''}`;

    // ---- Option A: send through Web3Forms straight to the owner's inbox ----
    if (canUseWeb3Forms) {
      setStatus('sending');
      try {
        const res = await fetch(WEB3FORMS_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            access_key: WEB3FORMS_KEY,
            subject, // email subject line
            from_name: name.trim() || 'Benfora visitor',
            email: email.trim() || undefined, // lets you hit Reply in your inbox
            type: typeLabel,
            rating: rating ? `${rating}/5` : 'Not rated',
            message: message.trim(),
            page: window.location.href, // which page the feedback came from
            botcheck: false,
          }),
        });
        const data = (await res.json().catch(() => ({}))) as { success?: boolean };
        if (!res.ok || !data.success) throw new Error('send failed');
        track('feedback_sent', { type, rating: rating ?? 0 }); // count it (the message text is never sent to analytics)
        setStatus('sent');
      } catch {
        setStatus('error'); // show the error message with a retry option
      }
      return;
    }

    // ---- Option B: no Web3Forms key, so open the visitor's email app with the message filled in ----
    const body = `${message.trim()}\n\nRating: ${rating ? `${rating}/5` : 'not rated'}${name.trim() ? `\n- ${name.trim()}` : ''}`;
    window.location.href = `mailto:${SITE.contactEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    track('feedback_sent', { type, rating: rating ?? 0, method: 'email_app' });
    setStatus('sent');
  }

  // Clears the form so the visitor can send another message.
  function reset() {
    setMessage('');
    setRating(null);
    setStatus('idle');
  }

  return (
    <SubPageShell>
      <main className="mx-auto mt-20 max-w-2xl">
        {/* ---- Page heading (same style as the About page) ---- */}
        <p className="text-sm font-medium uppercase tracking-widest text-pulse">Feedback</p>
        <h1 className="mt-4 text-5xl font-semibold leading-[1.02] tracking-tight [font-stretch:112%] md:text-6xl">
          Tell us what you think.
        </h1>
        <p className="mt-6 text-lg leading-relaxed text-paper/65">
          Found a bug, have an idea, or want something explained better? Every message gets read.
        </p>

        {/* ---- Thank-you screen, shown after a successful send ---- */}
        {status === 'sent' ? (
          <div role="status" className="mt-12 rounded-2xl border border-graphite/60 p-8">
            <p className="text-4xl" aria-hidden>
              🙌
            </p>
            <h2 className="mt-4 text-2xl font-semibold tracking-tight">Thank you!</h2>
            <p className="mt-2 leading-relaxed text-paper/65">
              {canUseWeb3Forms
                ? `Your feedback has been sent${email.trim() ? ', and we’ll reply to you by email if needed' : ''}.`
                : 'Your email app should have opened with your message. Press send there to finish.'}
            </p>
            <button
              type="button"
              onClick={reset}
              className="mt-6 rounded-full border border-graphite px-5 py-2.5 text-sm text-paper hover:border-paper/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pulse"
            >
              Send more feedback
            </button>
          </div>
        ) : !ready ? (
          /* ---- Neither Web3Forms nor a contact email is set up yet ---- */
          <p className="mt-10 text-paper/65">
            Feedback isn&apos;t set up yet. Please check back soon
            {SITE.linkedinUrl ? ' or reach out on LinkedIn.' : '.'}
          </p>
        ) : (
          /* ---- The feedback form ---- */
          <form onSubmit={onSubmit} className="mt-12 space-y-9" noValidate>
            {/* 1. What kind of feedback: one button per type, works like radio buttons */}
            <fieldset>
              <legend className="text-sm text-haze">What&apos;s it about?</legend>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4" role="radiogroup">
                {TYPES.map((t) => {
                  const on = type === t.id; // is this the selected type?
                  return (
                    <button
                      key={t.id}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => setType(t.id)}
                      className={`rounded-xl border px-3 py-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pulse ${
                        on ? 'border-pulse bg-pulse/15 text-paper' : 'border-graphite text-paper/80 hover:border-paper/50'
                      }`}
                    >
                      <span className="block text-2xl" aria-hidden>
                        {t.emoji}
                      </span>
                      <span className="mt-2 block text-sm font-medium">{t.label}</span>
                    </button>
                  );
                })}
              </div>
            </fieldset>

            {/* 2. Optional 1-5 rating; clicking the selected face again clears it */}
            <fieldset>
              <legend className="text-sm text-haze">
                How would you rate Benfora so far? <span className="text-haze/70">(optional)</span>
              </legend>
              <div className="mt-3 flex flex-wrap gap-2" role="radiogroup">
                {RATINGS.map((r) => {
                  const on = rating === r.value;
                  return (
                    <button
                      key={r.value}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      aria-label={`${r.value} out of 5, ${r.label}`}
                      title={r.label}
                      onClick={() => setRating(on ? null : r.value)}
                      className={`flex h-14 w-14 items-center justify-center rounded-xl border text-2xl transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pulse ${
                        on ? 'scale-110 border-pulse bg-pulse/15' : 'border-graphite hover:border-paper/50'
                      }`}
                    >
                      {r.face}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            {/* 3. The message itself (required), with a live character count */}
            <div>
              <label htmlFor="message" className="text-sm text-haze">
                Your feedback
              </label>
              <textarea
                id="message"
                required
                rows={6}
                maxLength={MAX_MESSAGE}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="What worked, what didn’t, what you’d love to see…"
                className={field}
              />
              <p className="mt-2 flex justify-between text-xs text-haze">
                <span>{tooShort && message.length > 0 ? `A little more detail please (at least ${MIN_MESSAGE} characters).` : ' '}</span>
                <span>
                  {message.length}/{MAX_MESSAGE}
                </span>
              </p>
            </div>

            {/* 4. Optional name and email, side by side on wider screens */}
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="name" className="text-sm text-haze">
                  Your name <span className="text-haze/70">(optional)</span>
                </label>
                <input id="name" type="text" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} className={field} />
              </div>
              {canUseWeb3Forms && ( // email only makes sense when we send the message ourselves
                <div>
                  <label htmlFor="email" className="text-sm text-haze">
                    Email for a reply <span className="text-haze/70">(optional)</span>
                  </label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className={field}
                  />
                </div>
              )}
            </div>

            {/* Honeypot: hidden from people, but bots fill it in, which lets us ignore them */}
            <input
              type="checkbox"
              name="botcheck"
              tabIndex={-1}
              autoComplete="off"
              checked={botcheck}
              onChange={(e) => setBotcheck(e.target.checked)}
              className="hidden"
              aria-hidden
            />

            {/* Error message if sending failed (e.g. no internet) */}
            {status === 'error' && (
              <p role="alert" className="rounded-xl border border-bolt/50 bg-bolt/10 px-4 py-3 text-sm text-paper">
                Sorry, your feedback couldn&apos;t be sent. Check your connection and try again.
              </p>
            )}

            {/* Send button: disabled until the message is long enough */}
            <div className="flex flex-wrap items-center gap-4">
              <button
                type="submit"
                disabled={tooShort || status === 'sending'}
                className="rounded-full bg-pulse px-6 py-3 text-sm font-medium text-white hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-paper"
              >
                {status === 'sending' ? 'Sending…' : 'Send feedback'}
              </button>
              <p className="text-sm text-haze">Nothing from your spreadsheets is ever included.</p>
            </div>
          </form>
        )}
      </main>
    </SubPageShell>
  );
}
