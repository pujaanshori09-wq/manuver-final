# Product

<!-- impeccable:product-schema 1 -->

## Platform

adaptive

One shared design language across iOS and Android (Expo / React Native, tested in Expo Go). Native affordances (safe areas, haptics, system light/dark) are respected on both.

## Users

People in Indonesia (first market: Bandung and other major cities) who play recreational sports — badminton, futsal, basketball, tennis, padel, running, gym and more — and need a reliable partner, an opponent for sparring, or a last-minute replacement player. They open the app on their phone, often on the move, minutes to days before a game.

## Product Purpose

Manuver matches people to play sports together. Users swipe nearby players filtered by sport, distance and skill, chat with matches, create or join play sessions ("Ajak Main"), post emergency calls when one player is missing ("Darurat Kurang 1"), and discover sports events. Success = a real game happens with someone reliable.

## Positioning

A dating-app-grade matching experience built specifically for sport: matching on sport, skill level, schedule and role (player, learner, mentor, coach), plus a reliability signal and an SOS flow to replace a missing player within minutes — things a general social or dating app does not do.

## Operating Context

- Discover (swipe) → match → chat → agree on venue/time → play.
- Sessions: create a session with slots; others join.
- Emergency board: "Temanmu batal main? Pasang SOS dan temukan pengganti dalam 10 menit."
- Events & tournaments by sport category.
- Backend: Supabase (auth, profiles, matches, RPC for nearby profiles). Location-based.

## Capabilities and Constraints

- Existing profile data: photos, sports (max 3 preferences), frequency, preferred time, sport role, experience length, height, domicile, Q&A prompts (max 3 of 5), bio.
- UI redesign (Nov 2026) must not change Supabase schema or data flow without explicit approval; new questions reuse existing fields.
- UI language: English is the default; Indonesian is the alternative, switchable at welcome/login and in Settings, persisted on device. Server content (names, bios, venues) is not translated.
- Premium ("Manuver Pro": tiers Pro and Elite) is presentation-only: no payment system exists, no prices are shown, CTA is "Coming soon · Notify me" with no transaction and no database write.
- Minimum age 18+.

## Brand Commitments

- Name: Manuver. Subtitle: "Find Your Play Partner".
- Palette pinned by the owner: glossy orange, black and white. Light/dark follows the system; the Discover/swipe screen is always dark.
- Layout patterns follow owner-supplied reference screenshots of a mainstream swipe-matching app (chip questionnaires, photo grid, floating pill tab bar, grouped settings, profile completion). Only patterns are borrowed — never another brand's name, logo, tier names or copy.
- Existing tab icons are kept as they are.
- Voice: casual, sporty, encouraging ("Gas main", "Cari lawan sparing").

## Evidence on Hand

- Store listing draft: `docs/STORE_LISTING_AND_BETA_PLAN.md`.
- No real testimonials, user counts, or pricing exist — do not fabricate them.

## Product Principles

1. A real game is the goal; every screen should move the user toward playing.
2. Trust first: reliability, safety, block/report are always reachable.
3. Sport-specific beats generic: skill, role, schedule and sport are first-class.
4. Fast on the move: big tap targets, short flows, one decision per screen.

## Accessibility & Inclusion

- Text contrast ≥ 4.5:1 in both light and dark themes; orange is never the only carrier of meaning.
- Bilingual UI (EN/ID).
