# How Julia Galef's calibration test works

Research for issue #2 (child of map #1, "Wayfinder: Confidence calibration quiz").
Retrieved 2026-10-18.

## Primary sources

- **[Q]** Questions page: https://juliagalef.com/calibration/ (WordPress `article:published_time` 2021-04-13, modified 2021-04-13)
- **[A]** Answer key: https://juliagalef.com/calibration-answers/ (published 2021-04-13)
- Both pages are companions to Chapter Six of *The Scout Mindset* (Julia Galef, 2021). [Q] opens: "In Chapter Six of *The Scout Mindset*, I discuss the skill of calibration…"

## TL;DR

| Aspect | Galef's test | Our planned quiz |
|---|---|---|
| Medium | Static web page, meant to be filled in by hand ("circle an answer") | Interactive app |
| Items | 40 fixed items in 4 themed rounds of 10. Answering all of them is optional | Original item bank |
| Answer format | Binary: True/False, or pick one of two names | Binary, two choices |
| Confidence options | **55, 65, 75, 85, 95%**. There is **no 50% or 100%** | 50/60/70/80/90/100% |
| Scoring | Self-scored. For each confidence level: hit rate = right / (right + wrong) | (to decide) |
| Results | A blank 5-row table to fill in by hand. **No chart, no verdict, no overall score** | (to decide) |
| License | No license or permission notice. Default copyright applies | Use the format only. Write every item ourselves |

## 1. Number of items

- "I've put together a set of forty trivia questions for you to practice on. You don't need to answer all of them, but the more you answer, the more informative your results will be." [Q]
- The questions come in four rounds of 10, each with a heading [Q]:
  1. "Are these animal facts true or false?" (Q1–10, T/F)
  2. "Which historical figure was born first?" (Q11–20, A-or-B, e.g. "Julius Caesar or Confucius?")
  3. "Which country had more people in 2019?" (Q21–30, A-or-B)
  4. "Are these science facts true or false?" (Q31–40, T/F)
- Every item has exactly two possible answers. Items are not randomized, and nothing is timed. The page is just a static list.

## 2. Confidence scale and what 50% means

- Instruction, verbatim: "For each question, circle an answer and then indicate how sure you are by circling a confidence level." [Q]
- The 50% and 100% endpoints are defined but not offered as choices: "Since these questions have only two possible answers, your confidence level could range from 50 percent if you truly have no clue (i.e., you might as well be guessing the outcome of a coin flip) to 100 percent if you think there is no chance you could be wrong." [Q]
- The choices offered: "For the sake of simplicity, I've listed five confidence levels between those extremes: 55%, 65%, 75%, 85%, and 95%. Just circle the one that best represents how sure you are." [Q] The five choices are printed after every item [Q].
- How she defines calibration: "your '50% sure' claims are in fact correct 50 percent of the time, your '60% sure' claims are correct 60 percent of the time … Perfect calibration is an abstract ideal, not something that's possible to achieve in reality. Still, it's a useful benchmark." [Q]
- The goal she states: "the goal isn't to know as much as possible. It's to know how much you know." [Q]

**Implication for us:** Galef uses the midpoints of five 10-point bins and never offers the extremes. Our planned 50/60/70/80/90/100 scale differs from hers in two ways:
- 50% means "pure coin flip". It is a legitimate choice, and a 50% bucket is well calibrated at about a 50% hit rate.
- 100% means "no chance I'm wrong", so a single miss in that bucket is a calibration failure.

Neither is wrong, but our scale is a deliberate change from hers, not a copy of it.

## 3. Scoring

All scoring is done by hand [Q]:

1. "Check the answer key to find out which you got right and which you got wrong." The answer key [A] gives the correct answer for each item, usually with a one-line explanation. For example, Q1: "False. The blue whale, not the elephant, is the largest mammal." Round 3 answers give the population figures.
2. "Go through only the questions about which you were '55% sure' and calculate the percentage of those questions you actually got right." Her worked example: 10 items at 55%, 6 right, gives 6 / 10 = 60 percent.
3. Repeat for each confidence level.

There is no overall score, no Brier or log score, and no penalty for unanswered items. The only output is the hit rate for each confidence level.

## 4. Results display

- The page has a static table to fill in [Q]. Its rows are "55% sure", "65% sure", "75% sure", "85% sure" and "95% sure". Its columns are:
  - "Column A: Number of times you were right"
  - "Column B: Number of times you were wrong"
  - "% of the time you're right at this confidence level = A / (A + B)"
- The web page has **no chart, no calibration curve, and no verdict** (such as "overconfident" or "underconfident"). You interpret the table yourself by comparing each row's percentage with its label.
- Afterword [Q]: "calibration is a skill with a quick learning curve. A couple of hours of practice is all it takes for most people to become very well calibrated — at least within a single domain, like trivia questions. (Your calibration skill in one domain will carry over partially, but not completely, to other domains.)"
- Not verified: whether the printed book shows a calibration chart in Chapter Six. I did not consult the book, so we should not claim either way. Reader reports report their results as a per-bucket hit rate, for example "55%, 65%, 75%, 85% and 95% … turned out to be 50%, 67%, 80%, 100% and 100% correct" ([tmy.se](https://tmy.se/calibrating-beliefs)). These are secondary sources.

## 5. Licensing / permission status

- Neither page carries a copyright notice, license (Creative Commons or otherwise), terms of use, or reuse permission. The only footer text is "Blog at WordPress.com." plus a cookie notice. I checked the raw HTML of [Q] for "copyright", "©", "license", "Creative Commons" and "all rights reserved", and none of them appear.
- **No license notice means no permission.** Under default copyright, the following belong to Galef (and possibly her publisher, since the material accompanies the book): the wording of the 40 items, how they are grouped into themed rounds, the answer-key explanations, and the instructional prose. **We must not copy, adapt, or lightly paraphrase her items or her answer key**, and we should not use her round themes as a template item by item.
- The underlying facts are not copyrightable. Examples are "blue whales are the largest mammal" and "Confucius was born before Caesar". Even so, our item bank should be written independently and should not draw on her list. That keeps provenance clean and avoids the "selection and arrangement" objection.
- The *format* is a method or idea, not protected expression. It consists of binary questions, a stated confidence level, and hit-rate tabulation per confidence level. Copyright does not extend to "any idea, procedure, process, system, method of operation, concept, principle, or discovery" ([17 U.S.C. §102(b)](https://www.law.cornell.edu/uscode/text/17/102)). Calibration quizzes in this style also predate her (they come from the forecasting and rationality literature). So building a "Galef-style" binary calibration quiz is fine. This is not legal advice.
- Attribution: we are not required to credit her for the format. A courtesy line such as "inspired by Julia Galef's calibration exercise in *The Scout Mindset*", with a link, is low-risk and honest. We should not imply endorsement.

## Open questions this raises for the map

- Should we keep Galef's 55–95 midpoints, or go with 50–100 including the endpoints (current plan)? See §2.
- Results: Galef gives only a hit-rate table. A chart, a verdict, and an aggregate score would all be our own additions to design.
