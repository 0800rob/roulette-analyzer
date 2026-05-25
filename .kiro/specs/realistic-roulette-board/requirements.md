# Requirements Document

## Introduction

This feature transforms the existing simplified roulette board into a realistic casino-grade interface with three core components: (1) a betting table layout that faithfully replicates a real European roulette table with all standard betting areas, (2) a racetrack (oval track) displaying numbers in their physical wheel order with traditional sector markings, and (3) a prediction engine that analyzes spin history to suggest at least 5 numbers likely to appear next, using frequency analysis, sector analysis, neighbor analysis, and trend detection heuristics.

The system is a React + Vite + TypeScript frontend communicating with a FastAPI Python backend. The prediction logic runs server-side and is exposed via a REST API endpoint.

## Glossary

- **Betting_Table**: The rectangular grid component that displays numbers 1-36 in 3 rows × 12 columns with the zero cell, outside bets, and column bets, replicating a real casino roulette table layout
- **Racetrack**: An oval SVG component displaying all 37 numbers in the exact physical order they appear on a European roulette wheel, with traditional sector markings
- **Prediction_Engine**: The backend module that analyzes spin history and produces a ranked list of predicted numbers with confidence scores and reasoning
- **Prediction_Panel**: The frontend component that displays predicted numbers, their confidence scores, and reasoning labels
- **European_Wheel_Order**: The fixed sequence of numbers on a European roulette wheel: 0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26
- **Sector**: A named group of consecutive numbers on the physical wheel; traditional sectors are Voisins du Zéro (17 numbers), Tiers du Cylindre (12 numbers), and Orphelins (8 numbers)
- **Confidence_Score**: A floating-point value between 0.0 and 1.0 representing the relative strength of a prediction
- **Spin**: A single recorded roulette result consisting of a number (0-36) and its associated color
- **Outside_Bets**: Betting areas outside the main number grid including dozens (1st 12, 2nd 12, 3rd 12), even-money bets (1-18, 19-36, Even, Odd, Red, Black), and column bets (2:1)
- **Neighbor_Analysis**: A heuristic that examines numbers physically adjacent to recent results on the wheel
- **Frequency_Analysis**: A heuristic that identifies numbers appearing more often than expected, weighted toward recent spins
- **Sector_Analysis**: A heuristic that detects concentration of results within specific wheel sectors
- **Trend_Analysis**: A heuristic that identifies patterns in color, parity, and dozen sequences

## Requirements

### Requirement 1: Betting Table Number Grid

**User Story:** As a roulette player, I want the betting table to display numbers exactly as they appear on a real casino table, so that I can quickly locate and select numbers in a familiar layout.

#### Acceptance Criteria

1. THE Betting_Table SHALL render numbers 1-36 in a grid of 3 rows × 12 columns where row 1 contains [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36], row 2 contains [2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35], and row 3 contains [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34]
2. THE Betting_Table SHALL render the zero (0) as a single cell spanning the full height of the 3-row grid, positioned to the left of column 1
3. THE Betting_Table SHALL display each number cell with the correct background color: red (#c0392b) for numbers in the set {1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36}, black (#2c3e50) for numbers in the set {2,4,6,8,10,11,13,15,17,20,22,24,26,28,29,31,33,35}, and green (#27ae60) for zero
4. THE Betting_Table SHALL display white text for all number cells to ensure readability against colored backgrounds

### Requirement 2: Betting Table Outside Bets

**User Story:** As a roulette player, I want to see all standard outside betting areas on the table, so that the layout matches what I see in a real casino.

#### Acceptance Criteria

1. THE Betting_Table SHALL render a dozen-bets row below the number grid containing three equally-sized cells labeled "1st 12", "2nd 12", and "3rd 12"
2. THE Betting_Table SHALL render an even-money-bets row below the dozen-bets row containing six equally-sized cells labeled "1-18", "EVEN", "RED", "BLACK", "ODD", "19-36" in that order from left to right
3. THE Betting_Table SHALL render a column-bets column to the right of the number grid containing three cells labeled "2:1", one per row
4. THE Betting_Table SHALL apply a red background to the "RED" cell and a black background to the "BLACK" cell in the even-money-bets row

### Requirement 3: Betting Table Interaction

**User Story:** As a roulette player, I want to click numbers on the betting table to record spins, so that I can quickly log results during a game.

#### Acceptance Criteria

1. WHEN a user clicks a number cell on the Betting_Table, THE Betting_Table SHALL invoke the onSelect callback with the clicked number as argument
2. WHILE the Betting_Table disabled prop is true, THE Betting_Table SHALL prevent all click interactions and display a visual disabled state on all cells
3. WHEN a new spin is recorded, THE Betting_Table SHALL highlight the last recorded number with a gold border (2px solid #ffd700) to distinguish it from other numbers
4. WHEN predicted numbers are provided, THE Betting_Table SHALL display a pulsing glow effect on each predicted number cell to visually differentiate predictions from regular numbers

### Requirement 4: Racetrack Layout

**User Story:** As a roulette player, I want to see a racetrack showing numbers in their physical wheel order, so that I can visualize sector patterns and neighbor relationships.

#### Acceptance Criteria

1. THE Racetrack SHALL render an oval SVG shape containing 37 equally-sized arc segments, one for each number from 0 to 36
2. THE Racetrack SHALL arrange numbers in the European_Wheel_Order: 0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26
3. THE Racetrack SHALL color each segment with the correct number color: red (#c0392b), black (#2c3e50), or green (#27ae60) for zero
4. THE Racetrack SHALL display the number label centered within each arc segment using white text

### Requirement 5: Racetrack Sectors

**User Story:** As a roulette player, I want to see traditional wheel sectors marked on the racetrack, so that I can identify Voisins du Zéro, Tiers du Cylindre, and Orphelins at a glance.

#### Acceptance Criteria

1. THE Racetrack SHALL visually demarcate the Voisins du Zéro sector covering numbers: 22, 18, 29, 7, 28, 12, 35, 3, 26, 0, 32, 15, 19, 4, 21, 2, 25
2. THE Racetrack SHALL visually demarcate the Tiers du Cylindre sector covering numbers: 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33
3. THE Racetrack SHALL visually demarcate the Orphelins sector covering numbers: 17, 34, 6 and 1, 20, 14, 31, 9
4. THE Racetrack SHALL display sector labels ("Voisins", "Tiers", "Orphelins") positioned outside the oval adjacent to their respective sectors

### Requirement 6: Racetrack Interaction

**User Story:** As a roulette player, I want to click numbers on the racetrack to record spins, so that I have an alternative input method based on wheel position.

#### Acceptance Criteria

1. WHEN a user clicks a segment on the Racetrack, THE Racetrack SHALL invoke the onSelect callback with the clicked number as argument
2. WHILE the Racetrack disabled prop is true, THE Racetrack SHALL prevent all click interactions
3. WHEN a new spin is recorded, THE Racetrack SHALL highlight the last recorded number segment with a gold border to distinguish it from other segments
4. WHEN predicted numbers are provided, THE Racetrack SHALL display a pulsing glow effect on each predicted number segment

### Requirement 7: Prediction Engine Computation

**User Story:** As a roulette player, I want the system to analyze my spin history and suggest numbers likely to come next, so that I can make more informed betting decisions.

#### Acceptance Criteria

1. WHEN a session has 10 or more recorded spins, THE Prediction_Engine SHALL compute and return at least 5 predicted numbers
2. WHEN a session has fewer than 10 recorded spins, THE Prediction_Engine SHALL return an empty predictions list
3. THE Prediction_Engine SHALL assign each predicted number a Confidence_Score between 0.0 and 1.0
4. THE Prediction_Engine SHALL assign each predicted number at least one reasoning label from the set: "frequency", "sector", "neighbor", "trend"
5. THE Prediction_Engine SHALL return predictions sorted by Confidence_Score in descending order

### Requirement 8: Prediction Algorithm Heuristics

**User Story:** As a roulette player, I want predictions based on multiple analysis strategies, so that the suggestions consider different patterns in the data.

#### Acceptance Criteria

1. THE Prediction_Engine SHALL combine four heuristics with the following weights: Frequency_Analysis at 30%, Sector_Analysis at 25%, Neighbor_Analysis at 25%, and Trend_Analysis at 20%
2. THE Frequency_Analysis SHALL apply exponential decay weighting to spins, giving higher weight to more recent spins
3. THE Sector_Analysis SHALL divide the European wheel into sectors and detect sectors with above-average hit concentration in the analysis window
4. THE Neighbor_Analysis SHALL identify the 2 numbers to the left and 2 numbers to the right of the last recorded number on the physical wheel
5. THE Trend_Analysis SHALL detect repeating patterns in color sequences, parity sequences, and dozen sequences from the last 20 spins

### Requirement 9: Prediction API Endpoint

**User Story:** As a frontend developer, I want a REST endpoint that returns predictions for a session, so that the UI can fetch and display prediction data.

#### Acceptance Criteria

1. THE Backend SHALL expose a GET endpoint at the path /api/sessions/{session_id}/predictions
2. WHEN the session_id does not correspond to an existing session, THE Backend SHALL return HTTP status 404 with a descriptive error message
3. WHEN the session has fewer than 10 spins, THE Backend SHALL return a response with an empty predictions array and the total spin count
4. THE Backend SHALL include in the response: a predictions array (each item containing number, color, confidence_score, and reasons), an analysis_window field indicating the number of spins analyzed, and a min_spins_required field set to 10
5. THE Backend SHALL compute the prediction response within 100 milliseconds for sessions with up to 1000 recorded spins

### Requirement 10: Prediction Panel Display

**User Story:** As a roulette player, I want to see predicted numbers displayed clearly with their confidence and reasoning, so that I can quickly understand the suggestions.

#### Acceptance Criteria

1. WHEN predictions are available, THE Prediction_Panel SHALL display each predicted number as a colored circle (matching the number color) with the Confidence_Score shown as a percentage below the number
2. WHEN predictions are available, THE Prediction_Panel SHALL display reasoning labels next to each prediction using icons: "🔥" for frequency, "🎯" for sector, "👥" for neighbor, "📈" for trend
3. WHEN the session has fewer than 10 spins, THE Prediction_Panel SHALL display the message "Registre pelo menos 10 giros para obter previsões"
4. WHEN a new spin is recorded, THE Prediction_Panel SHALL refresh predictions automatically without requiring manual user action

### Requirement 11: Visual Theme Consistency

**User Story:** As a user, I want the new components to match the existing dark theme, so that the interface feels cohesive.

#### Acceptance Criteria

1. THE Betting_Table SHALL use background color #16213e for the table container and border color #0f3460 for cell borders
2. THE Racetrack SHALL use background color #16213e for the component container and stroke color #0f3460 for segment borders
3. THE Prediction_Panel SHALL use background color #16213e for the panel container and accent color #e94560 for highlighted elements
4. THE Betting_Table, Racetrack, and Prediction_Panel SHALL render correctly on viewports with a minimum width of 768 pixels

### Requirement 12: Dependency Constraints

**User Story:** As a developer, I want the implementation to avoid new external dependencies, so that the bundle size remains small and maintenance burden stays low.

#### Acceptance Criteria

1. THE Racetrack SHALL be implemented using native SVG elements rendered via React without additional charting or SVG libraries
2. THE Prediction_Engine SHALL be implemented using Python standard library and existing project dependencies (FastAPI, SQLAlchemy, Pydantic) without additional machine learning or statistics libraries
3. THE Betting_Table SHALL be implemented using CSS Grid layout without additional CSS frameworks or component libraries
