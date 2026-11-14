'use client';

import { useState } from 'react';
import { SubPageShell } from '@/components/SubPageShell';
import { SITE } from '@/lib/site';

const TOPICS = ['General feedback', 'Something looks wrong', 'Feature idea', 'Just saying hi'];

const field =
  'mt-2 w-full rounded-xl border border-graphite bg-transparent px-4 py-3 text-paper placeholder:text-haze focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pulse';

export default function FeedbackPage() {
  const [topic, setTopic] = useState(TOPICS[0]);
  const [message, setMessage] = useState('');
  const [name, setName] = useState('');
  const [sent, setSent] = useState(false);

  const email = SITE.contactEmail;

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;
    const body = `${message.trim()}${name.trim() ? `\n\n- ${name.trim()}` : ''}`;
    const subject = `${SITE.name} feedback: ${topic}`;
    // No server involved: this opens the visitor's own email app with the message filled in.
    window.location.href = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    setSent(true);
  }

  return (
    <SubPageShell>
      <main className="mx-auto mt-20 max-w-2xl">
        <p className="text-sm font-medium uppercase tracking-widest text-pulse">Feedback</p>
        <h1 className="mt-4 text-5xl font-semibold leading-[1.02] tracking-tight [font-stretch:112%] md:text-6xl">
          Tell us what you think.
        </h1>
        <p className="mt-6 text-lg leading-relaxed text-paper/65">
          Found a bug, have an idea, or want something explained better? Every message gets read.
        </p>

        {email ? (
          <form onSubmit={onSubmit} className="mt-10 space-y-6">
            <div>
              <label htmlFor="topic" className="text-sm text-haze">
                What&apos;s it about?
              </label>
              <select id="topic" value={topic} onChange={(e) => setTopic(e.target.value)} className={field}>
                {TOPICS.map((t) => (
                  <option key={t} value={t} className="bg-ink">
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="message" className="text-sm text-haze">
                Your feedback
              </label>
              <textarea
                id="message"
                required
                rows={6}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="What worked, what didn't, what you'd love to see…"
                className={field}
              />
            </div>

            <div>
              <label htmlFor="name" className="text-sm text-haze">
                Your name <span className="text-haze/70">(optional)</span>
              </label>
              <input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)} className={field} />
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <button
                type="submit"
                className="rounded-full bg-pulse px-6 py-3 text-sm font-medium text-white hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-paper"
              >
                Send feedback
              </button>
              {sent && (
                <p role="status" className="text-sm text-haze">
                  Your email app should have opened. Hit send there to finish. Thank you!
                </p>
              )}
            </div>
            <p className="text-sm text-haze">
              This opens your email app with your message ready to send. Nothing from your spreadsheets is ever included.
            </p>
          </form>
        ) : (
          <p className="mt-10 text-paper/65">
            Feedback isn&apos;t set up yet. Please check back soon
            {SITE.linkedinUrl ? ' or reach out on LinkedIn.' : '.'}
          </p>
        )}
      </main>
    </SubPageShell>
  );
}
