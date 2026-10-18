# Research: scoring and displaying calibration of binary forecasts

Ticket: #3 "How should calibration be scored and displayed?" (child of map #1, Confidence calibration quiz).
Date: 2026-10-18.

Context assumed: binary items (two choices); the player picks an answer and a confidence from
{50, 60, 70, 80, 90, 100}%; results show a per-round calibration curve and Brier score, plus a lifetime curve.

Source-trust legend: **[P]** primary (the paper or organisation that owns the claim), **[S]** secondary
(a third-party summary; treat as pointer, verify before relying on wording), **[C]** our own computation.

---

## 1. Brier score

### Definition and the two scales

- Common (0 to 1) form for binary events: `BS = (1/N) * sum_t (f_t - o_t)^2`, where `f_t` is the forecast
  probability of the event and `o_t` is 1 if it happened, else 0. Lower is better; 0 is perfect.
  Brier's original 1950 form sums over both outcome classes, so for binary events it is exactly **twice**
  the common form (range 0 to 2).
  - Brier, G. W. (1950). Verification of forecasts expressed in terms of probability. *Monthly Weather
    Review* 78(1):1-3. doi:10.1175/1520-0493(1950)078<0001:VOFEIT>2.0.CO;2 [P, via
    [Wikipedia summary](https://en.wikipedia.org/wiki/Brier_score) S]
- **Good Judgment Open uses the original 0-to-2 scale**: "The best (lowest) possible Brier score is 0, and
  the worst (highest) possible Brier score is 2." Its headline metric for players is a *Relative* Brier
  score: your score minus the crowd's median score (negative = you beat the crowd).
  [GJ Open FAQ](https://www.gjopen.com/faq) [P]

### Applying it to our item format

A "pick an answer + confidence c in [0.5, 1]" response is equivalent to forecasting probability `c` that the
chosen answer is correct (the "half-range" format of the classic calibration literature, see section 5). So
per item, on the 0-1 scale [C]:

| confidence | correct | wrong |
|---|---|---|
| 50% | 0.25 | 0.25 |
| 60% | 0.16 | 0.36 |
| 70% | 0.09 | 0.49 |
| 80% | 0.04 | 0.64 |
| 90% | 0.01 | 0.81 |
| 100% | 0.00 | 1.00 |

Useful anchors for players: always answering 50% scores exactly **0.25** regardless of knowledge
(the "coin-flip" baseline); the worst possible is 1.00 (100% sure and wrong). Because the Brier score is
bounded, a 100% option is safe to offer — unlike the log score, which is infinite for a confident miss
(this is why Greenberg's training app caps stated probabilities at 99%; see below).

### Murphy decomposition (reliability / resolution / uncertainty)

With forecasts taking K distinct values `f_k` (we have exactly 6), `n_k` items at value `f_k`, observed hit
rate `o_k` in that bucket, and overall hit rate `o`:

```
BS = REL - RES + UNC
REL = (1/N) sum_k n_k (f_k - o_k)^2     # calibration error; 0 = perfectly calibrated
RES = (1/N) sum_k n_k (o_k - o)^2       # how much bucket hit rates differ from the overall rate
UNC = o (1 - o)                          # depends only on outcomes
```

- Murphy, A. H. (1973). A new vector partition of the probability score. *J. Applied Meteorology*
  12(4):595-600. doi:10.1175/1520-0450(1973)012<0595:ANVPOT>2.0.CO;2 [P, via Wikipedia S]
- When forecasts take only a few discrete values and buckets are exactly those values (our case), the
  decomposition is exact [C: it is the standard within/between-groups sum-of-squares identity; there is
  no within-bin forecast variance term because every forecast in a bucket is identical]. The usual
  "approximate" caveat applies only when continuous forecasts are binned.
- Dimitriadis, Gneiting & Jordan's CORP paper generalises this as `score = MCB - DSC + UNC`
  (miscalibration, discrimination, uncertainty) and notes that in "discrete settings where there are only a
  few predictive probabilities ... this is straightforward" — i.e. the binning problems they solve do not
  arise for a fixed menu like ours. Dimitriadis, Gneiting, Jordan (2021), Stable reliability diagrams for
  probabilistic classifiers, *PNAS* 118(8). [arXiv:2008.03033](https://arxiv.org/abs/2008.03033) [P]

**Caveat specific to our format.** In the half-range format the "event" is "my chosen answer was right",
so UNC = o(1-o) depends on how many the player got right, and RES rewards discriminating between items you
know and items you don't. Both are meaningful, but UNC is not a fixed property of the item bank (it would
be if we scored "option A is true" instead). This means comparing raw Brier scores across rounds partly
compares knowledge, not only calibration.

### Presenting it to lay players

Evidence and conventions found:

- Greenberg (lead developer of the Open Philanthropy / Clearer Thinking calibration-training app) reports
  from user testing that standard proper scores feel unintuitive: users expect **higher = better**, a
  **positive score only when right and negative only when wrong**, and **zero points for a 50/50 guess**.
  He calls the standard Brier score "perhaps even less intuitive than the quadratic scoring rule" for this
  purpose. For true/false questions his app uses a rescaled log score:
  `S(p) = s_max * (log p_or_(1-p) - log(1/2)) / (log p_max - log(1/2))` with `p_max = 0.99`, `s_max = 10`.
  Greenberg, S. (2018). Calibration scoring rules for practical prediction training.
  [arXiv:1808.07501](https://arxiv.org/abs/1808.07501) [P]
- GJ Open shows the raw Brier (0-2) but leads with a crowd-relative score, so the player's question
  "is this good?" is answered by comparison. [GJ Open FAQ](https://www.gjopen.com/faq) [P]
- Julia Galef's paper-and-pencil calibration test (the stated inspiration for this quiz) scores only
  per-bucket hit rates `A / (A + B)` and frames perfect calibration as "an abstract ideal ... a useful
  benchmark against which to compare yourself" — no single overall score. Notably it uses confidence
  levels 55/65/75/85/95% (bucket midpoints), avoiding 50 and 100 endpoints.
  [juliagalef.com/calibration](https://juliagalef.com/calibration/) [P]

Implications for us (options, not decisions):

1. Show the Brier score with anchors: "0 = perfect, 0.25 = always saying 50%, 1 = always certain and wrong",
   so the number has meaning without the formula. Optionally a skill-style transform
   `1 - BS/0.25` (0 = no better than guessing at 50%, 1 = perfect; negative = worse than guessing), which
   satisfies Greenberg's "zero for a coin flip, higher is better" properties while staying a linear
   (still proper) transform of Brier.
2. Pick one scale (0-1 vs GJ's 0-2) and say which; mixing them is a known confusion source.
3. Consider showing the decomposition in words rather than numbers: a calibration line ("your confidence
   matched your accuracy within X points") separate from a knowledge/discrimination line. REL is
   directly readable off the curve; RES and UNC are hard to explain and probably belong in a "details" view.
4. A single summary over/underconfidence number is standard and easy to explain:
   `mean confidence - overall % correct` (positive = overconfident). See section 5.

---

## 2. How many items per bucket before a point means something

There is no single canonical threshold in the sources found; the literature's answer is "show the
uncertainty" (Bröcker & Smith 2007; Dimitriadis et al. 2021). Lichtenstein, Fischhoff & Phillips note that
because calibration needs lots of data, "most of the studies ... reported data grouped across assessors in
order to secure the large quantities of data needed for stable estimates of calibration" [S, quoting the
1982 chapter]. The binomial arithmetic makes the scale concrete.

**95% Wilson confidence intervals for bucket accuracy** [C]:

| n in bucket | at 60% observed | at 70% | at 80% | at 90% |
|---|---|---|---|---|
| 5 | 3/5: 23-88% | 4/5: 38-96% | 4/5: 38-96% | 4/5: 38-96% |
| 10 | 6/10: 31-83% | 7/10: 40-89% | 8/10: 49-94% | 9/10: 60-98% |
| 20 | 12/20: 39-78% | 14/20: 48-85% | 16/20: 58-92% | 18/20: 70-97% |
| 30 | 18/30: 42-75% | 21/30: 52-83% | 24/30: 63-90% | 27/30: 74-97% |
| 50 | 30/50: 46-72% | 35/50: 56-81% | 40/50: 67-89% | 45/50: 79-96% |
| 100 | 60/100: 50-69% | 70/100: 60-78% | 80/100: 71-87% | 90/100: 83-94% |

Items needed for a 95% interval of roughly +/-10 points: ~97 at 50%, ~81 at 70%, ~35 at 90% [C, normal
approximation]. For +/-20 points: ~25, ~21, ~9.

Takeaways:

- With a round of, say, 10-20 items spread over 6 buckets, **per-round bucket points are almost pure
  noise** (2-4 items per bucket; intervals span 40-70 points). A per-round curve can only honestly convey
  gross patterns (e.g. "you missed 3 of your 4 100%-sure answers").
- A meaningful per-bucket reading needs on the order of **20-30 items per bucket** (interval width
  ~+/-15-20 points), which realistically is a **lifetime-curve** property, not a per-round one.
- A common rule of thumb is to suppress or de-emphasise points below a minimum n (5 or 10 are typical
  choices); this is convention, not a sourced standard. Our table shows n=5 gives intervals ~50-60 points
  wide; n=10 ~40-50 points.

**Which interval.** Brown, Cai & DasGupta (2001) show the textbook Wald interval `p +/- 1.96 sqrt(p(1-p)/n)`
has erratic, poor coverage and collapses to zero width at 0/n and n/n (exactly the case for a 100% bucket
with no misses). They recommend the **Wilson** interval (or Jeffreys) for small n.
*Statistical Science* 16(2):101-133. doi:10.1214/ss/1009213286 [P bibliographic; recommendation confirmed
via abstract summaries S].

**Confidence interval vs consistency band.** Two different error bars are in use:

- *Confidence interval around the observed hit rate* (Wilson): "where is this player's true accuracy at
  this confidence level?" Easy to explain.
- *Consistency band around the diagonal* (Bröcker & Smith 2007): "how far would a perfectly calibrated
  player's hit rate typically wander with this many items?" Computed from the Binomial(n_k, f_k) under the
  assumption of perfect calibration; a point outside the band is evidence of miscalibration. Bröcker, J. &
  Smith, L. A. (2007). Increasing the reliability of reliability diagrams. *Weather and Forecasting*
  22(3):651-661. [LSE preprint](https://www.lse.ac.uk/CATS/Assets/PDFs/Publications/Papers/2007/73-IncreasingReliabilityDiagrams-2006-Brocker-Smith.pdf) [P].
  Dimitriadis et al. (2021) cite Bröcker & Smith as "convincingly advocat[ing] the need for uncertainty
  quantification, so that structural deviations ... from the diagonal can be distinguished from deviations
  that merely reflect noise", and offer both consistency and confidence bands, using 90% in their figures. [P]

95% consistency ranges for a perfectly calibrated player [C, exact binomial 2.5/97.5 percentiles]:

| n | 50% | 60% | 70% | 80% | 90% |
|---|---|---|---|---|---|
| 5 | 0-100% | 20-100% | 20-100% | 40-100% | 60-100% |
| 10 | 20-80% | 30-90% | 40-100% | 50-100% | 70-100% |
| 20 | 30-70% | 40-80% | 50-90% | 60-95% | 75-100% |
| 40 | 35-65% | 45-75% | 55-82% | 67-92% | 80-97% |

The 100% bucket is special: a perfectly calibrated player never misses, so the consistency band is a single
point and **any miss is conclusive overconfidence** at that level — worth calling out explicitly to players.

---

## 3. Displaying sparse or empty buckets

Conventions from the forecast-verification literature:

- **Show the counts.** "Traditionally, reliability diagrams have been accompanied by histograms or bar plots
  of the marginal distribution of the predictive probabilities" — the *refinement* or *sharpness*
  distribution — typically using the same bins as the diagram. Dimitriadis et al. (2021) [P]; their
  figures place the histogram under the x-axis. Equivalent lighter-weight forms: per-point labels ("3/4"),
  or marker size/opacity proportional to n.
- **Show uncertainty per point** (section 2) so sparse points visibly carry wide bars rather than looking
  as authoritative as dense ones. Dimitriadis et al. note sparsely populated bins "are subject to
  overfitting and large estimation uncertainty", producing spurious spikes. [P]
- **Empty buckets: draw no point**, and do not connect the curve through a gap as if there were data
  [convention; C]. Keep the x position on the axis (all six ticks always present) so the player sees they
  never used that level. Hit rate is undefined at n=0, never 0%.
- For a lifetime curve, sparse buckets fill in over time; for a per-round curve, consider de-emphasising
  (hollow/faded marker) points below a minimum n and stating the counts.

---

## 4. Perfect-calibration reference line and over/underconfidence regions

- **Axes and diagonal.** The reliability (calibration) diagram plots stated probability (x) against observed
  frequency (y); the 45-degree identity line is perfect calibration. Universal across meteorology
  (Hsu & Murphy 1986, attributes diagram), ML calibration (Dimitriadis et al. 2021), and the psychology
  literature. [P/S]
- **Region semantics for confidence-in-own-answer** (our format): a point **below** the diagonal means
  accuracy lower than stated confidence = **overconfident**; **above** = **underconfident**. (For
  event-probability forecasts the same geometry is described as over-/under-forecasting.) [S, consistent
  across sources]
- **Our axis range.** Because confidence is 50-100%, the x-axis should run 50-100%. The y-axis (accuracy)
  can fall below 50% (a player can be worse than chance on items they were 60% sure of), so y should run
  0-100% or at least to the observed minimum; clipping y at 50% would hide the most interesting failure.
  [C] The half-range calibration curves in Lichtenstein, Fischhoff & Phillips use this 0.5-1.0 x-range;
  their example: "as confidence increases from .5 to 1.0, the percentage of correct answers might increase
  from 50% to 80%" — the typical overconfident shape, flatter than the diagonal. [S, quoted from the 1982
  chapter: *Judgment under Uncertainty*, Kahneman, Slovic & Tversky (eds.), pp. 306-334,
  [Cambridge](https://www.cambridge.org/core/books/abs/judgment-under-uncertainty/calibration-of-probabilities-the-state-of-the-art-to-1980/9F0C9EC2997AEEB6DDDB304C2F935A16)]
- **Shading.** Labelled tinted half-planes ("overconfident" below, "underconfident" above) are a common
  pedagogical device; no primary standard dictates colours. The meteorological *attributes diagram* adds a
  horizontal "no-resolution" line at the base rate and a "no-skill" line midway between it and the diagonal,
  shading the region where points contribute positively to Brier skill. Credited to Hsu, W.-R. & Murphy,
  A. H. (1986), The attributes diagram, *Int. J. Forecasting* 2(3):285-293 [P bibliographic; line semantics
  via [IRI CPT help](https://cpthelp.iri.columbia.edu/Tools_Verify_Attributes.html) S]. This is probably
  too technical for lay players; the plain diagonal plus two labelled regions is the accessible subset.
- **Hard-easy effect.** People tend to be overconfident on hard item sets and underconfident on easy ones
  (Lichtenstein & Fischhoff 1977, *Organizational Behavior and Human Performance* 20(2):159-183) [S].
  Implication: a round's curve shape depends on how hard the drawn items were, another reason to lean on
  the lifetime curve.

---

## 5. Summary measures from the psychology literature (half-range format)

The classic two-alternative, 0.5-1.0 confidence paradigm (Lichtenstein & Fischhoff 1977; Lichtenstein,
Fischhoff & Phillips 1982) is exactly our format. Its standard summaries [S for attribution; formulas
are the Murphy terms above]:

- **Calibration index** = REL from the Murphy decomposition (weighted mean squared gap between each
  bucket's confidence and its hit rate).
- **Over/underconfidence** = mean confidence - proportion correct. Positive = overconfident. One number,
  sign-interpretable, easy for players ("on average you were 12 points more confident than you were right").
- **Resolution / discrimination** = RES: whether your higher-confidence answers were actually right more
  often.

---

## Open questions this research does not settle

- Round size (determines whether a per-round curve is worth showing at all versus only per-round Brier +
  over/underconfidence, with the curve reserved for lifetime).
- Which error bar to show players (Wilson CI around their point vs a consistency band around the diagonal),
  or none with only counts.
- Brier scale (0-1 vs 0-2) and whether to show a transformed "higher is better" score.

## Sources

- Brier (1950), *Monthly Weather Review* 78(1):1-3.
- Murphy (1973), *J. Applied Meteorology* 12(4):595-600.
- [Brier score - Wikipedia](https://en.wikipedia.org/wiki/Brier_score) (formula and citation pointer)
- [Good Judgment Open FAQ](https://www.gjopen.com/faq)
- Greenberg (2018), [Calibration scoring rules for practical prediction training, arXiv:1808.07501](https://arxiv.org/abs/1808.07501)
- Dimitriadis, Gneiting & Jordan (2021), [Stable reliability diagrams for probabilistic classifiers, PNAS / arXiv:2008.03033](https://arxiv.org/abs/2008.03033)
- Bröcker & Smith (2007), [Increasing the reliability of reliability diagrams, *Weather and Forecasting* 22(3)](https://www.lse.ac.uk/CATS/Assets/PDFs/Publications/Papers/2007/73-IncreasingReliabilityDiagrams-2006-Brocker-Smith.pdf)
- Brown, Cai & DasGupta (2001), [Interval estimation for a binomial proportion, *Statistical Science* 16(2)](https://doi.org/10.1214/ss/1009213286)
- Hsu & Murphy (1986), The attributes diagram, *Int. J. Forecasting* 2(3); [IRI explainer](https://cpthelp.iri.columbia.edu/Tools_Verify_Attributes.html)
- Lichtenstein & Fischhoff (1977), *OBHP* 20(2):159-183; Lichtenstein, Fischhoff & Phillips (1982),
  [Calibration of probabilities: the state of the art to 1980](https://www.cambridge.org/core/books/abs/judgment-under-uncertainty/calibration-of-probabilities-the-state-of-the-art-to-1980/9F0C9EC2997AEEB6DDDB304C2F935A16)
- [Julia Galef, calibration test](https://juliagalef.com/calibration/)

Not reachable during research (403): Metaculus scoring FAQ and track-record page; full text of the
Lichtenstein et al. reports on DTIC. Metaculus-specific conventions are therefore not covered.
