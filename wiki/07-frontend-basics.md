# Frontend basics (React)

## Components: the screen is built from small, nested pieces

Rather than writing one big program that draws an entire page, React apps are built from **components** — small, self-contained, reusable pieces (a button, a card, a whole page section) that can be combined like building blocks. A page is usually a component made of other components, which are made of others still, down to basic building blocks like buttons and text inputs.

Each component describes what should appear on screen based on the data it currently has. You don't manually write "now go find this element and change its text" — you describe what the UI should look like *given* the current data, and the framework figures out how to update the actual screen to match.

## State: data a component remembers

**State** is data that a component holds onto between renders and that, when it changes, causes the component to redraw itself with the new value. A text input's current value, whether a loading spinner should show, the list of exams fetched from the API — all of that is state. The core loop of most interactive components is: something happens (a click, an API response arriving) → state updates → the component re-renders to reflect it.

## Props: data passed in from outside

**Props** are how a parent component hands data down to a child component — e.g. a list component passes each individual exam's data down to an `ExamCard` component to render. Props flow one direction, parent to child; a child can't reach up and directly change its parent's data — if a child needs to cause a change, the parent passes it a function (also just a prop) that the child calls, and the parent decides what to do with it.

## The loading/success/error pattern

Fetching data from an API takes time and can fail, and a component needs to represent all three of those states so the screen never looks broken or stuck. The pattern used throughout Grade-M8: an initial "loading" state while the request is in flight, then either the successful data or an error message, driven by plain state that gets set once the request resolves. There's no special magic to this — it's just state, updated at each stage of an async operation, with the component's rendering logic checking which stage it's currently in.

## Routing: URL decides what renders

A **single-page app** doesn't reload the whole page for every navigation — instead, a **router** watches the current URL and decides which top-level component to render (`/subjects` renders the subjects list, `/subjects/123` renders that subject's detail page). Route parameters (the `123` part) get passed into the matched component so it knows which specific resource to fetch and display.

**Role-gating** builds on this: certain routes should only render for certain roles (a student shouldn't be able to navigate to the exam-creation screen even by typing the URL directly). This is enforced by a wrapper around the route that checks the logged-in user's role (from their auth token, see [Auth & roles](./04-auth-and-roles.md)) before rendering the real page, redirecting elsewhere if the check fails.

## Where components get their look from

Components describe structure and behavior; how they actually look (colors, spacing, fonts) is a separate concern, covered next.

Next: [Design systems & tokens](./08-design-systems-and-tokens.md) — where a button's exact color and padding actually come from.
