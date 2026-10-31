# Quizzes

A collection of short quizzes that train reasoning skills, played in rounds and tracked over time.

## Language

### Confidence quiz

**Calibration quiz**:
A quiz that measures how well a player's stated confidence matches how often they're actually right, as opposed to how much they know.
_Avoid_: Confidence test, certainty quiz

**Calibration item**:
A single binary question in a calibration quiz: a prompt with exactly two choices, one of them correct.
_Avoid_: Question (reserved for Reasoning Traps), trivia

**Four-way item**:
An item in the Advanced quiz: a predicate checked against each of two options independently, so neither, either, or both may be true. The player answers Neither, one option, or Both.
_Avoid_: Advanced item (Advanced names the quiz), multi-answer question

**Confidence**:
The probability a player assigns to their chosen answer being correct: 50–100% in 10% steps on a calibration item (50% means a pure guess), or 0–100% in 25% steps on a four-way item (25% means a pure guess).
_Avoid_: Certainty, sureness

**Confidence bucket**:
All of a player's answers given at the same confidence level.
_Avoid_: Bin, band

**Calibration curve**:
A plot of each confidence bucket's actual accuracy against its stated confidence, set against the line of perfect calibration.
_Avoid_: Calibration chart, reliability diagram (in player-facing text)

**Brier score**:
The mean squared difference between stated confidence and outcome (1 for correct, 0 for wrong). Lower is better.
_Avoid_: Calibration score

**Skill score**:
A player's Brier score restated so that guessing scores the quiz's chance rate (50 on a two-choice quiz, 25 on a four-way quiz) and perfect answers score 100. Higher is better, and below the chance rate is worse than guessing. It rewards knowledge as well as calibration.
_Avoid_: Calibration score, accuracy

**Pending round**:
A round that has been drawn and is being answered but hasn't been submitted. It doesn't count toward the player's record until it is.
_Avoid_: Draft, unfinished round

**Lifetime**:
All of a player's submitted answers for one quiz, the basis of the lifetime calibration curve and Brier score.
_Avoid_: All-time, history (in player-facing text)

**Overconfidence**:
A player's mean stated confidence minus their percentage of correct answers, over a round or their lifetime, in percentage points. Positive means overconfident, negative means underconfident, and near zero means well calibrated.
_Avoid_: Bias, calibration error

**Confident answer**:
An answer given at one of the top two confidence stops: 90 or 100% on a calibration item, 75 or 100% on a four-way item. Any other answer is hedged. The item review sorts a round's answers into confident misses, hedged misses, underplayed hits (hedged but right) and confident hits.
_Avoid_: Sure answer, high-confidence answer

### Flash cards

**Flash card quiz**:
A scored, multiple-choice quiz that drills one family of concepts, either biases or fallacies, in both directions: from a definition or example to the term, and from the term to its definition.
_Avoid_: Flip cards, deck

**Deck**:
The concepts of one type (all the biases, or all the fallacies) that a flash card quiz draws its targets from. Lures can come from either deck. The game-theory hub's cards use their own concepts as a separate deck, whose lures come only from itself.
_Avoid_: Bank (names the calibration item files), category

**Target**:
The concept a flash card asks about. Its term or its definition is the one correct option.
_Avoid_: Answer (names the option, not the concept), trait (in flash card text)

**Card direction**:
Which way a flash card runs: definition → term, example → term, or term → definition. The two → term directions together are drawn twice as often as term → definition. Results aren't stored per direction.
_Avoid_: Card type, mode

**Knowledge base**:
The shared set of concept entries (biases and fallacies) that Reasoning Traps and the flash card quizzes all draw on.
_Avoid_: Glossary (names the Reasoning Traps page)

**Spotting tip**:
A concept's own advice on how to recognise it, read without comparing it to any other concept.
_Avoid_: Distinguishing tip (it mixed spotting tips and pair tips)

**Confused pair**:
Two concepts, in either order, that learners often mistake for each other. A pair can join a bias and a fallacy.
_Avoid_: Commonly confused with, confusion

**Pair tip**:
The single contrast text for a confused pair. It names both concepts and the feature that tells them apart, and belongs to the pair, not to either concept.
_Avoid_: Distinguishing tip, contrast tip

**Lure**:
A wrong option on a flash card, offered because it is easy to mistake for the right answer. Lures come first from the target's confused pairs, and can come from either deck.
_Avoid_: Distractor (in player-facing text), wrong answer

**Draw weight**:
How likely a concept is to be chosen as the next card's target in a flash card quiz, relative to the others in its deck. Weaker concepts weigh more, but a mastered concept never drops below the baseline, so it keeps appearing.
_Avoid_: Weak spots (names the Reasoning Traps round mode), priority

### Practice layer

**Practice layer**:
The app-wide record of when and how much a player practises, across every quiz: the Practice streak, Rest days, Mastery, Badges and the Today panel. It is separate from each quiz's own results.
_Avoid_: Gamification, progress system, XP

**Answer streak**:
The number of consecutive correct answers in one quiz. A wrong answer resets it. The library card shows it as "Current streak".
_Avoid_: Streak (bare, because it also names the Practice streak), score streak

**Practice day**:
A local calendar date on which the player gave at least 5 scored answers across any quizzes, or answered the game-theory daily puzzle. Wrong answers count.
_Avoid_: Login day, active day

**Practice streak**:
The number of consecutive practice days, with missed days covered by Rest days. It counts effort, not correctness.
_Avoid_: Streak (bare), login streak, daily streak

**Rest day**:
A day the Practice streak survives without practice. The player starts with one and holds at most two. One is granted every 7 days while below the cap, and one is spent automatically on a missed day. In code this is a streak freeze.
_Avoid_: Freeze, life, shield, power-up

**Mastery**:
A concept's state, derived from the player's pooled counts: New, Learning, Practised or Mastered. It is recomputed on read, so it can fall.
_Avoid_: Level, rank, XP, score

**Badge**:
A note that the player has shown one specific idea. It is informational: never summed into a total, never ranked, never revoked.
_Avoid_: Achievement, trophy, reward

**Today panel**:
The panel at the top of the library that shows the Practice streak, the Rest days, a suggested quiz and the week's variety.
_Avoid_: Dashboard, home

### Easier quizzes

**Basic quiz**:
The calibration quiz with easier items and shorter rounds (10 items). It uses the two-way answer control and its own item bank and history.
_Avoid_: Easy mode, beginner quiz (it is a separate quiz, not a setting)

**Item level**:
How hard a calibration item is for a typical adult: 1 (most are right), 2 or 3 (near a coin flip). Authored, never shown to players, and absent from the Confidence and Advanced banks.
_Avoid_: Difficulty (names the Reasoning Traps question field), tier

**Easy start**:
A new player's first Reasoning Traps answers, drawn from the easiest questions and shown with a short option list. It ends after a few answers.
_Avoid_: Tutorial mode, beginner mode

**First-run hint**:
A short line of help that shows only while a player has no results in a quiz.
_Avoid_: Onboarding, tooltip

### Game theory

**Game theory hub**:
The one mini-app that groups the game-theory cards, puzzles, bots, contests and tutorials.
_Avoid_: Game theory quiz, course

**Payoff matrix**:
The table of what each player gets for every pair of choices, with the row player's payoff first.
_Avoid_: Grid, bimatrix (in player-facing text)

**Payoff**:
What a player cares about getting from an outcome, as a number. It is not necessarily money and says nothing about selfishness.
_Avoid_: Score (Skill score exists), reward, points, money

**Equilibrium**:
A cell where each player's choice is a best response to the other's. It is stable, not necessarily best or unique.
_Avoid_: Solution, the answer, best outcome

**Best response**:
The choice that gives a player the highest payoff against one specific choice by the other.
_Avoid_: Best move

**Dominated strategy**:
A choice that is strictly worse for a player than another single choice, whatever the other player does. Only strict, pure-strategy dominance is used.
_Avoid_: Bad move, weak dominance (not used)

**Puzzle**:
A generated item on a payoff matrix: find the equilibrium, classify the game, or eliminate dominated strategies.
_Avoid_: Question (Reasoning Traps), item (calibration), card (flash cards)

**Puzzle set**:
Five puzzles of one kind, or interleaved, played together.
_Avoid_: Quiz, round

**Cover story**:
The scenario and labels wrapped around a payoff matrix. It varies between puzzles so that the structure, not the story, is what gets learned.
_Avoid_: Theme, skin

**Bot**:
A named, rule-based opponent in a repeated game. Its choices follow the history so far, with randomness only where its rule says so.
_Avoid_: AI, computer player

**Match**:
A sequence of turns between the player, or a bot, and one bot.
_Avoid_: Game (names the type of interaction), round (names a quiz round)

**Turn**:
One simultaneous pair of choices in a match.
_Avoid_: Round, move (names a single choice)

**Noise**:
The chance that a played move is flipped by mistake.
_Avoid_: Error rate, randomness

**Tournament**:
Every bot in a population playing every other, ranked by mean payoff per turn.
_Avoid_: League, ladder

**Simulated players**:
The model-driven players in the beauty contest and the auctions. They are not real people and not a real crowd.
_Avoid_: Crowd, other players, users, people

**Reasoning level**:
How many steps ahead a guess assumes others reason (L0, L1, and so on). It describes a guess, not the player.
_Avoid_: Level (bare, because it also names an Item level), IQ, rank

**Tutorial**:
A concept's three-stage introduction: Explore (a worked example), Try (a faded example) and Solo (unassisted items).
_Avoid_: Lesson, course

**Introduced**:
A concept whose tutorial has reached Try, or that has been tested out. Only introduced concepts are tested.
_Avoid_: Unlocked, learned

**Test out**:
Skipping a tutorial by passing a short unassisted check.
_Avoid_: Placement test

**Daily puzzle**:
One puzzle per local date, generated from the date and the player's unlocked puzzle kinds.
_Avoid_: Daily challenge, quest

**Reason check**:
A one-answer follow-up asking why an answer is right, with options that target common misconceptions.
_Avoid_: Explanation, justification

**Misconception**:
A common wrong belief that a reason-check option or a line of feedback targets.
_Avoid_: Mistake, lure (names a flash card option)
