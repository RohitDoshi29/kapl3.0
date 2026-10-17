import { Ball, Innings, Team } from './cricketTypes';

/**
 * Cricket ball-by-ball commentary generation engine.
 * Generates vivid, broadcast-style cricket commentary with realistic shot descriptions,
 * dismissal narratives, and over summaries.
 */

interface CommentaryContext {
  ball: Ball;
  overNumber: number;
  ballNumber: number;
  batsmanName: string;
  bowlerName: string;
  battingTeamName: string;
  isOverEnd?: boolean;
  inningsRuns?: number;
  inningsWickets?: number;
}

const DOT_BALL_PHRASES = [
  "Good length on off stump, solidly defended with a straight bat back to the bowler.",
  "Beaten! Angling across the batter, plays away from the body and is beaten on the outside edge.",
  "Flatter trajectory on middle, pushed gently towards mid-off. Fielded cleanly, no run.",
  "Dug out in the blockhole! Tail-end yorker, jammed down in the nick of time.",
  "Short of a length outside off, left alone through to the keeper.",
  "Sharp turn off the turf! Deceives the batter on the backfoot, ball thuds into the pad outside line.",
  "Pitched up on off, checked drive straight to cover. Tight bowling line."
];

const SINGLE_PHRASES = [
  "Pushed down to long-on for a calm single. Strike safely rotated.",
  "Tucked off the hips towards backward square leg for an easy single.",
  "Steered neatly with open face down to third man for a single.",
  "Driven firmly along the carpet to sweeper cover for one run.",
  "Full toss worked away through mid-wicket, batters cross comfortably.",
  "Tap and run! Dropped with soft hands towards point and they scamper through for a quick single."
];

const TWO_RUN_PHRASES = [
  "Clipped into the vacant pocket at deep mid-wicket. Good hustle between the wickets, they come back for two!",
  "Driven sweetly through extra cover, fielder gives chase from the ring and cuts it off. A brace taken.",
  "Shortish delivery pulled behind square, good running turns one into two easily.",
  "Drifted into the pads, glanced fine down to fine leg for a sharp double."
];

const THREE_RUN_PHRASES = [
  "Exquisite drive through the covers gap! Fielders chase all the way to the rope, saving one. Superb running for three!",
  "Pierced through the gap at deep point! Slows down before the boundary, batters hustle for three hard-run runs!"
];

const FOUR_PHRASES = [
  "CRACK! Short and wide outside off, carved past point with disdain! Races away like a tracer bullet for FOUR!",
  "DELICIOUS COVER DRIVE! Leans into the pitch, presents the full face of the willow, and caresses it through extra cover for FOUR!",
  "PULLED AWAY WITH FEROCITY! Reads the short delivery early, rocks back and hammers it into the deep mid-wicket fence for FOUR!",
  "STREAKY BUT EFFECTIVE! Thick outside edge flies over the slip cordon and skips away into the third man rope for FOUR!",
  "LOFTED DOWN THE GROUND! Clears the inner ring over mid-off, bounces twice and crosses the boundary rope! FOUR runs!",
  "WHIPPED OFF THE PADS! Sensational wristwork, whips it through mid-wicket with supreme flair for a stylish FOUR!"
];

const SIX_PHRASES = [
  "BOOM! Smashed high, handsome, and into the night sky! That is huge, clears the pavilion stands for a MONSTROUS SIX!",
  "STAND AND DELIVER! Down the track in a flash, meets the ball in the slot and sends it 90 meters over long-on for a MAXIMUM!",
  "DISPATCHED INTO ORBIT! Reads the slower ball, waits for it, and pulls it high into the night sky over deep square leg for SIX!",
  "WHAT A SHOT! Pure timing and elegance, lofts it straight back over the bowler's head into the camera gantry for SIX!",
  "OUT OF THE GROUND! Clean as a whistle off the sweet spot of the bat, that's flying into the parking lot! MAXIMUM SIX!"
];

/**
 * Deterministically pick an element based on seed numbers (over + ball)
 */
function pickBySeed<T>(list: T[], seed: number): T {
  const index = Math.abs(seed) % list.length;
  return list[index];
}

export function generateBallCommentary(ctx: CommentaryContext): string {
  const { ball, overNumber, ballNumber, batsmanName, bowlerName, isOverEnd, inningsRuns, inningsWickets } = ctx;
  const seed = overNumber * 10 + ballNumber;

  // 1. Wicket commentary
  if (ball.isWicket) {
    const type = ball.wicketDetails?.type || 'bowled';
    const fielder = ball.wicketDetails?.fielderName;

    switch (type) {
      case 'bowled':
        return `TIMBER! Clean bowled! ${bowlerName} attacks the stumps with venom, breaches the defense, and sends the stumps cartwheeling! ${batsmanName} has to walk back!`;
      case 'caught':
        return `IN THE AIR... AND TAKEN! Lofted high into the air towards ${fielder ? fielder : 'the deep'}, fielder settles underneath with ice in the veins and holds on! ${batsmanName} departs!`;
      case 'run_out':
        return `DISASTER! Direct hit! Yes, no, and confusion in the running! ${batsmanName} dives desperate to make the crease, but the bails are off! Run Out!`;
      case 'lbw':
        return `LOUD SHOUT AND GIVEN! ${bowlerName} traps ${batsmanName} right in front of middle stump! Umpire raises the dreaded finger! Plumb LBW!`;
      case 'stumped':
        return `STUMPED! Beaten in flight and turn! ${batsmanName} steps out, misses the pitch, and the wicketkeeper whips the bails off in the blink of an eye!`;
      case 'hit_wicket':
        return `UNFORTUNATE! Deep in the crease, strikes the ball but the heel clips the off bail! Hit wicket!`;
      default:
        return `WICKET! ${bowlerName} strikes! A massive breakthrough for the fielding team as ${batsmanName} walks back to the pavilion!`;
    }
  }

  // 2. No-ball & Free Hit
  if (ball.isNoBall) {
    const runsOffBat = ball.runsOffBat || 0;
    const batText = runsOffBat > 0 ? ` plus ${runsOffBat} run(s) scored off the willow!` : '';
    return `NO-BALL! Siren sounds, ${bowlerName} has overstepped the crease line! Extra run awarded${batText} ⚡ FREE HIT signaled for the next delivery!`;
  }

  // 3. Wide
  if (ball.isWide) {
    return `WIDE BALL! Fired well outside the tramline by ${bowlerName}. Umpire signals Wide. Extra run added, and the ball must be re-bowled.`;
  }

  // 4. Free Hit capitalizations
  if (ball.isFreeHit) {
    if (ball.runs === 6) {
      return `FREE HIT PUNISHED! ${batsmanName} takes full advantage of the free hit delivery and clubs it 85 meters into the stands for a MAXIMUM!`;
    }
    if (ball.runs === 4) {
      return `FREE HIT CAPITALIZED! ${batsmanName} slices through the infield and collects a glorious boundary FOUR!`;
    }
    if (ball.runs === 0) {
      return `GOLDEN BALL FOR THE BOWLER! Outstanding execution under pressure, nails the yorker on Free Hit. Dot ball!`;
    }
  }

  // 5. Boundary 6
  if (ball.runs === 6) {
    const phrase = pickBySeed(SIX_PHRASES, seed);
    return `${phrase} (${batsmanName} to ${bowlerName})`;
  }

  // 6. Boundary 4
  if (ball.runs === 4) {
    const phrase = pickBySeed(FOUR_PHRASES, seed);
    return `${phrase} (${batsmanName} to ${bowlerName})`;
  }

  // 7. 1D Declared Run
  if (ball.runs === 1 && !ball.isWide && !ball.isNoBall && (ball as any).isDeclared) {
    return `Hit into the declared zone! 1 Run Declared. Strike remains with ${batsmanName}.`;
  }

  // 8. 3 Runs
  if (ball.runs === 3) {
    return pickBySeed(THREE_RUN_PHRASES, seed);
  }

  // 9. 2 Runs
  if (ball.runs === 2) {
    return pickBySeed(TWO_RUN_PHRASES, seed);
  }

  // 10. 1 Run
  if (ball.runs === 1) {
    return pickBySeed(SINGLE_PHRASES, seed);
  }

  // 11. Penalty runs
  if (ball.runs < 0) {
    return `PENALTY RUNS! ${Math.abs(ball.runs)} runs deducted from the batting team due to penalty regulations.`;
  }

  // 12. Dot ball
  return pickBySeed(DOT_BALL_PHRASES, seed);
}

/**
 * Returns an over summary string (e.g. End of Over 4)
 */
export function generateOverSummary(
  overNumber: number,
  overRuns: number,
  overWickets: number,
  teamTotalRuns: number,
  teamTotalWickets: number,
  bowlerName: string,
  battingTeamName: string
): string {
  return `📊 End of Over ${overNumber}: ${overRuns} runs, ${overWickets} wicket(s) conceded by ${bowlerName}. ${battingTeamName} stand at ${teamTotalRuns}/${teamTotalWickets}.`;
}

