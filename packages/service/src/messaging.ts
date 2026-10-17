import type { KnownBlock } from '@slack/web-api';
import MailComposer from 'nodemailer/lib/mail-composer';
import { slack } from './clients';

const FROM = 'Shop <orders@shop.example>';

/** Builds the email as the SMTP transport would send it, and returns its headers and size. */
export async function composeEmail(to: string, subject: string, html: string) {
  const message = await new MailComposer({ from: FROM, to, subject, html, text: html.replace(/<[^>]+>/g, '') }).compile().build();
  return { to, subject, bytes: message.length };
}

/** The Slack message a function would post to an operations channel. */
export function slackMessage(channel: string, title: string, lines: string[]) {
  const blocks: KnownBlock[] = [
    { type: 'header', text: { type: 'plain_text', text: title } },
    { type: 'section', text: { type: 'mrkdwn', text: lines.map((l) => `• ${l}`).join('\n') } }
  ];
  return { channel, text: title, blocks, apiUrl: slack.slackApiUrl };
}
