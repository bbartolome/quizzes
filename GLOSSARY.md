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
