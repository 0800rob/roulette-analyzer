# Implementation Plan: Realistic Roulette Board

## Overview

This plan implements a casino-grade roulette interface with three core components: a BettingTable (CSS Grid layout with outside bets), a Racetrack (SVG oval in European wheel order with sector markings), and a PredictionEngine (backend heuristic analysis) + PredictionPanel (frontend display). The implementation builds incrementally — shared constants first, then backend prediction logic, then frontend components, and finally integration wiring.

## Tasks

- [x] 1. Set up shared constants and type definitions
  - [x] 1.1 Create frontend constants file with wheel order, sectors, colors, and grid layout
    - Create `frontend/src/constants.ts` with `EUROPEAN_WHEEL_ORDER`, `SECTORS`, `RED_NUMBERS`, `BETTING_TABLE_ROWS`, and `COLORS` objects
    - _Requirements: 1.1, 1.3, 4.2, 5.1, 5.2, 5.3, 11.1, 11.2, 11.3_

  - [x] 1.2 Add prediction schemas to the backend
    - Add `PredictionItem` and `PredictionResponse` Pydantic models to `backend/app/schemas.py`
    - `PredictionItem`: number (int), color (str), confidence_score (float 0.0-1.0), reasons (list[str])
    - `PredictionResponse`: predictions (list[PredictionItem]), analysis_window (int), min_spins_required (int = 10), total_spins (int)
    - _Requirements: 9.4_

  - [x] 1.3 Add prediction API types to the frontend API client
    - Add `Prediction` and `PredictionResponse` interfaces to `frontend/src/api.ts`
    - Add `getPredictions(sessionId: number)` function calling `GET /sessions/{id}/predictions`
    - _Requirements: 9.1, 9.4_

- [x] 2. Implement the Prediction Engine (backend)
  - [x] 2.1 Create the prediction engine module with frequency analysis
    - Create `backend/app/prediction_engine.py` with `EUROPEAN_WHEEL_ORDER`, `HEURISTIC_WEIGHTS`, `MIN_SPINS_REQUIRED` constants
    - Implement `frequency_analysis(spins)` using exponential decay (factor 0.95), normalizing scores to [0, 1]
    - _Requirements: 8.1, 8.2_

  - [x] 2.2 Implement sector analysis heuristic
    - Implement `sector_analysis(spins)` that divides the wheel into ~6 sectors, counts hits per sector, identifies hot sectors with above-average concentration, and normalizes scores
    - _Requirements: 8.3_

  - [x] 2.3 Implement neighbor analysis heuristic
    - Implement `neighbor_analysis(spins)` that finds the last spin's position in `EUROPEAN_WHEEL_ORDER` and assigns scores: 1.0 to ±1 neighbors, 0.5 to ±2 neighbors, 0.0 to all others
    - _Requirements: 8.4_

  - [x] 2.4 Implement trend analysis heuristic
    - Implement `trend_analysis(spins)` that examines the last 20 spins for color streaks (3+), parity streaks (3+), and dozen streaks (3+), boosting matching numbers
    - _Requirements: 8.5_

  - [x] 2.5 Implement score combination and main compute_predictions entry point
    - Implement `combine_scores(freq, sector, neighbor, trend)` with weights 0.30/0.25/0.25/0.20, selecting top 5+ predictions sorted by confidence descending
    - Implement `compute_predictions(spins)` that returns empty list for <10 spins, otherwise runs all 4 heuristics and combines
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 8.1_

  - [ ]* 2.6 Write property tests for prediction engine (Property 6: Output validity)
    - **Property 6: Prediction output validity for sufficient spins**
    - Use Hypothesis to generate lists of 10+ spins, verify ≥5 predictions with valid confidence_scores and reasons
    - **Validates: Requirements 7.1, 7.3, 7.4, 7.5**

  - [ ]* 2.7 Write property tests for prediction engine (Property 7: Empty predictions)
    - **Property 7: Empty predictions for insufficient spins**
    - Use Hypothesis to generate lists of 0-9 spins, verify empty predictions list
    - **Validates: Requirements 7.2**

  - [ ]* 2.8 Write property tests for prediction engine (Property 8: Weighted combination)
    - **Property 8: Weighted combination correctness**
    - Use Hypothesis to generate four score dictionaries, verify combined = freq*0.30 + sector*0.25 + neighbor*0.25 + trend*0.20
    - **Validates: Requirements 8.1**

  - [ ]* 2.9 Write property tests for prediction engine (Property 9: Decay monotonicity)
    - **Property 9: Frequency analysis decay monotonicity**
    - Use Hypothesis to generate spin histories with repeated numbers at different positions, verify recent > older contribution
    - **Validates: Requirements 8.2**

  - [ ]* 2.10 Write property tests for prediction engine (Property 11: Neighbor identification)
    - **Property 11: Neighbor analysis identifies ±2 physical neighbors**
    - Use Hypothesis to generate any number 0-36 as last spin, verify exactly 4 non-zero scored neighbors
    - **Validates: Requirements 8.4**

- [x] 3. Implement the Prediction API endpoint
  - [x] 3.1 Add GET /api/sessions/{session_id}/predictions route to main.py
    - Query session and spins from DB, call `compute_predictions`, return `PredictionResponse`
    - Return 404 if session not found, return empty predictions if <10 spins
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

  - [ ]* 3.2 Write unit tests for the prediction API endpoint
    - Test 404 for non-existent session, empty predictions for <10 spins, valid response structure for ≥10 spins
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

- [x] 4. Checkpoint - Backend verification
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement the BettingTable component
  - [x] 5.1 Create BettingTable component with CSS Grid number layout
    - Create `frontend/src/components/BettingTable.tsx` with props: `onSelect`, `disabled`, `lastNumber`, `predictedNumbers`
    - Render zero cell spanning 3 rows on the left, 3×12 number grid using `BETTING_TABLE_ROWS`, correct colors from `RED_NUMBERS`
    - Use CSS Grid: `grid-template-columns: 60px repeat(12, 1fr) 60px`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 3.1, 3.2, 11.1, 12.3_

  - [x] 5.2 Add outside bets to BettingTable (dozens, even-money, column bets)
    - Add dozen-bets row: "1st 12", "2nd 12", "3rd 12"
    - Add even-money row: "1-18", "EVEN", "RED", "BLACK", "ODD", "19-36" with red/black backgrounds on RED/BLACK cells
    - Add column-bets column: three "2:1" cells to the right
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 5.3 Add interaction states to BettingTable (last number highlight, predicted glow, disabled)
    - Gold border (2px solid #ffd700) on `lastNumber` cell
    - Pulsing glow CSS animation on `predictedNumbers` cells
    - Disabled state prevents clicks and shows visual disabled state
    - _Requirements: 3.2, 3.3, 3.4_

  - [ ]* 5.4 Write unit tests for BettingTable component
    - Test grid renders 37 number cells, correct colors, click callback invoked with correct number, disabled state prevents clicks
    - _Requirements: 1.1, 1.3, 3.1, 3.2_

- [x] 6. Implement the Racetrack component
  - [x] 6.1 Create Racetrack SVG component with oval arc segments
    - Create `frontend/src/components/Racetrack.tsx` with props: `onSelect`, `disabled`, `lastNumber`, `predictedNumbers`
    - Render SVG oval with 37 donut-shaped arc segments in `EUROPEAN_WHEEL_ORDER`
    - Implement `computeArcSegments` and `describeArc` helper functions for SVG path generation
    - Color each segment correctly (red/black/green), display number labels centered in segments
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 11.2, 12.1_

  - [x] 6.2 Add sector markings and labels to Racetrack
    - Visually demarcate Voisins du Zéro, Tiers du Cylindre, and Orphelins sectors
    - Display sector labels ("Voisins", "Tiers", "Orphelins") positioned outside the oval
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [x] 6.3 Add interaction states to Racetrack (click, disabled, highlights, glow)
    - Click handler invokes `onSelect` with segment number
    - Disabled state prevents clicks
    - Gold border on `lastNumber` segment
    - Pulsing glow on `predictedNumbers` segments
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [ ]* 6.4 Write unit tests for Racetrack component
    - Test 37 segments rendered, correct wheel order, click callback, disabled state
    - _Requirements: 4.1, 4.2, 6.1, 6.2_

- [x] 7. Implement the PredictionPanel component
  - [x] 7.1 Create PredictionPanel component
    - Create `frontend/src/components/PredictionPanel.tsx` with props: `predictions`, `totalSpins`, `minSpinsRequired`, `loading`
    - Display colored circles for each predicted number with confidence percentage below
    - Display reasoning icons: 🔥 frequency, 🎯 sector, 👥 neighbor, 📈 trend
    - Show "Registre pelo menos 10 giros para obter previsões" when totalSpins < minSpinsRequired
    - Show loading skeleton when `loading` is true
    - Use dark theme colors (background #16213e, accent #e94560)
    - _Requirements: 10.1, 10.2, 10.3, 11.3_

  - [ ]* 7.2 Write unit tests for PredictionPanel component
    - Test minimum spins message display, prediction circles render with correct colors, reasoning icons display
    - _Requirements: 10.1, 10.2, 10.3_

- [x] 8. Checkpoint - Component verification
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Integrate components into Dashboard
  - [x] 9.1 Update Dashboard to replace RouletteBoard with BettingTable and Racetrack
    - Import and render `BettingTable` and `Racetrack` components instead of `RouletteBoard`
    - Pass `onSelect`, `disabled`, `lastNumber`, and `predictedNumbers` props
    - Track `lastNumber` state (updated after each spin)
    - _Requirements: 3.1, 6.1_

  - [x] 9.2 Add prediction fetching and PredictionPanel to Dashboard
    - Fetch predictions via `getPredictions(sessionId)` after each spin is recorded
    - Store predictions in state, pass to `PredictionPanel`, `BettingTable`, and `Racetrack`
    - Handle loading and error states for prediction fetch
    - _Requirements: 10.4, 9.1_

  - [x] 9.3 Ensure responsive layout for minimum 768px viewport
    - Arrange BettingTable, Racetrack, and PredictionPanel in a responsive grid layout
    - Verify all components render correctly at 768px minimum width
    - _Requirements: 11.4_

  - [ ]* 9.4 Write integration tests for Dashboard prediction flow
    - Test that adding a spin triggers prediction fetch, predictions are passed to child components
    - _Requirements: 10.4_

- [x] 10. Final checkpoint - Full integration verification
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The existing `RouletteBoard.tsx` is replaced by `BettingTable.tsx` — the old component can be removed during task 9.1
- Backend property tests use Hypothesis (dev dependency); frontend tests use fast-check + vitest + @testing-library/react (dev dependencies)
- No new runtime dependencies are introduced per Requirement 12

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3"] },
    { "id": 1, "tasks": ["2.1", "5.1"] },
    { "id": 2, "tasks": ["2.2", "2.3", "2.4", "5.2", "5.3"] },
    { "id": 3, "tasks": ["2.5", "5.4", "6.1"] },
    { "id": 4, "tasks": ["2.6", "2.7", "2.8", "2.9", "2.10", "3.1", "6.2", "6.3"] },
    { "id": 5, "tasks": ["3.2", "6.4", "7.1"] },
    { "id": 6, "tasks": ["7.2", "9.1"] },
    { "id": 7, "tasks": ["9.2", "9.3"] },
    { "id": 8, "tasks": ["9.4"] }
  ]
}
```
