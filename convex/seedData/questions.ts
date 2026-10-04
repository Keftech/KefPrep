/**
 * DEMO QUESTION BANK — development seed data only.
 *
 * These questions were written for KefPrep testing. They are:
 *   - source = "KEFPREP_GENERATED"
 *   - flagged isDemo = true
 *   - NEVER presented as IBBUL past questions.
 * Real past questions will be imported separately with source = PAST_QUESTION
 * and their original metadata (year, session, reference).
 */

export type DemoQuestionSeed = {
  t: string; // topic name
  q: string; // question text
  o: [string, string, string, string]; // four options
  a: 0 | 1 | 2 | 3; // correct option index
  e: string; // explanation (shown after submission)
  d: "EASY" | "MEDIUM" | "HARD";
};

export const MATH_TOPICS = [
  "Algebra",
  "Trigonometry",
  "Functions",
  "Statistics",
  "Other",
] as const;

/** Blueprint quotas: Format A (35Q) = 10/8/7/5/5; Format B (70Q) = all. */
export const MATH_QUOTA_A: Record<string, number> = {
  Algebra: 10,
  Trigonometry: 8,
  Functions: 7,
  Statistics: 5,
  Other: 5,
};

export const MATH_QUESTIONS: DemoQuestionSeed[] = [
  // ── Algebra (20) ──────────────────────────────────────────────────────
  { t: "Algebra", q: "Solve for x: 2x + 6 = 14", o: ["2", "4", "6", "8"], a: 1, e: "2x = 14 − 6 = 8, so x = 8 ÷ 2 = 4.", d: "EASY" },
  { t: "Algebra", q: "Expand: 3(2x − 4)", o: ["6x − 12", "6x − 4", "5x − 12", "6x + 12"], a: 0, e: "Distribute the 3: 3·2x = 6x and 3·(−4) = −12.", d: "EASY" },
  { t: "Algebra", q: "If x − 7 = 12, then x =", o: ["5", "12", "19", "24"], a: 2, e: "x = 12 + 7 = 19.", d: "EASY" },
  { t: "Algebra", q: "Expand: (x + 3)(x + 2)", o: ["x² + 5x + 6", "x² + 6x + 5", "x² + 5x + 5", "x² + 6"], a: 0, e: "FOIL: x² + 2x + 3x + 6 = x² + 5x + 6.", d: "EASY" },
  { t: "Algebra", q: "Factorise: x² − 9", o: ["(x − 3)(x + 3)", "(x − 9)(x + 1)", "(x − 3)²", "(x + 3)²"], a: 0, e: "Difference of two squares: a² − b² = (a − b)(a + b).", d: "MEDIUM" },
  { t: "Algebra", q: "Solve: 5x = 45", o: ["5", "9", "40", "50"], a: 1, e: "x = 45 ÷ 5 = 9.", d: "EASY" },
  { t: "Algebra", q: "Solve: x² = 49", o: ["x = 7 only", "x = −7 only", "x = 7 or x = −7", "x = ±1/7"], a: 2, e: "Both 7² and (−7)² equal 49.", d: "EASY" },
  { t: "Algebra", q: "Make x the subject: y = 2x + 1", o: ["x = (y − 1)/2", "x = 2y + 1", "x = (y + 1)/2", "x = y/2 + 1"], a: 0, e: "Subtract 1, then divide by 2: x = (y − 1)/2.", d: "MEDIUM" },
  { t: "Algebra", q: "Solve: 3x − 4 = 2x + 5", o: ["x = 1", "x = 5", "x = 9", "x = −9"], a: 2, e: "Subtract 2x: x − 4 = 5, so x = 9.", d: "MEDIUM" },
  { t: "Algebra", q: "Simplify: (2x³)(3x²)", o: ["5x⁵", "6x⁵", "6x⁶", "6x"], a: 1, e: "Multiply coefficients (2·3 = 6) and add exponents (3 + 2 = 5).", d: "MEDIUM" },
  { t: "Algebra", q: "Solve: 2x² − 8 = 0", o: ["x = 2", "x = −2", "x = 2 or x = −2", "x = 4"], a: 2, e: "2x² = 8 → x² = 4 → x = ±2.", d: "MEDIUM" },
  { t: "Algebra", q: "The gradient of the line through (1, 2) and (4, 8) is", o: ["1/2", "2", "3", "6"], a: 1, e: "Gradient = (8 − 2)/(4 − 1) = 6/3 = 2.", d: "EASY" },
  { t: "Algebra", q: "If a : b = 2 : 3 and a = 8, then b =", o: ["10", "12", "14", "16"], a: 1, e: "Scale factor is 4 (8 ÷ 2), so b = 3 × 4 = 12.", d: "EASY" },
  { t: "Algebra", q: "Simplify: (x² − 4)/(x − 2), for x ≠ 2", o: ["x − 2", "x + 2", "x² + 2", "1"], a: 1, e: "x² − 4 = (x − 2)(x + 2); the (x − 2) terms cancel.", d: "MEDIUM" },
  { t: "Algebra", q: "Solve: x + y = 10 and x − y = 4. What is x?", o: ["3", "6", "7", "14"], a: 2, e: "Add the equations: 2x = 14, so x = 7.", d: "MEDIUM" },
  { t: "Algebra", q: "Solve: 4x + 3 = 2x + 11", o: ["2", "4", "7", "8"], a: 1, e: "2x = 8, so x = 4.", d: "EASY" },
  { t: "Algebra", q: "Expand: (2x + 1)²", o: ["4x² + 4x + 1", "4x² + 1", "4x² + 2x + 1", "4x² + 4x + 2"], a: 0, e: "(2x + 1)(2x + 1) = 4x² + 2x + 2x + 1 = 4x² + 4x + 1.", d: "MEDIUM" },
  { t: "Algebra", q: "What is the sum of the roots of x² − 5x + 6 = 0?", o: ["−5", "5", "6", "−6"], a: 1, e: "For ax² + bx + c = 0, the sum of roots = −b/a = 5.", d: "MEDIUM" },
  { t: "Algebra", q: "Evaluate: 3⁻²", o: ["−9", "1/9", "−1/9", "9"], a: 1, e: "a⁻ⁿ = 1/aⁿ, so 3⁻² = 1/3² = 1/9.", d: "MEDIUM" },
  { t: "Algebra", q: "Solve: log₂ x = 5", o: ["10", "16", "25", "32"], a: 3, e: "log₂ x = 5 means 2⁵ = x, so x = 32.", d: "MEDIUM" },

  // ── Trigonometry (16) ────────────────────────────────────────────────
  { t: "Trigonometry", q: "The value of sin 30° is", o: ["0", "1/2", "√3/2", "1"], a: 1, e: "Standard exact value: sin 30° = 1/2.", d: "EASY" },
  { t: "Trigonometry", q: "The value of cos 0° is", o: ["0", "1/2", "1", "−1"], a: 2, e: "cos 0° = 1.", d: "EASY" },
  { t: "Trigonometry", q: "The value of tan 45° is", o: ["0", "1", "√3", "1/2"], a: 1, e: "tan 45° = sin 45° / cos 45° = 1.", d: "EASY" },
  { t: "Trigonometry", q: "The value of sin 90° is", o: ["0", "1/2", "√2/2", "1"], a: 3, e: "sin 90° = 1.", d: "EASY" },
  { t: "Trigonometry", q: "The value of cos 60° is", o: ["1/2", "√3/2", "√2/2", "0"], a: 0, e: "cos 60° = 1/2.", d: "EASY" },
  { t: "Trigonometry", q: "The value of tan 60° is", o: ["1", "1/√3", "√3", "√3/2"], a: 2, e: "tan 60° = √3.", d: "MEDIUM" },
  { t: "Trigonometry", q: "sin²θ + cos²θ is equal to", o: ["0", "1", "2", "tan²θ"], a: 1, e: "The Pythagorean identity: sin²θ + cos²θ = 1 for every θ.", d: "EASY" },
  { t: "Trigonometry", q: "In a right-angled triangle, the opposite side is 3 and the hypotenuse is 5. sin θ =", o: ["3/4", "3/5", "4/5", "5/3"], a: 1, e: "sin θ = opposite / hypotenuse = 3/5.", d: "EASY" },
  { t: "Trigonometry", q: "In a right-angled triangle, the adjacent side is 4 and the hypotenuse is 5. cos θ =", o: ["3/5", "4/5", "5/4", "1"], a: 1, e: "cos θ = adjacent / hypotenuse = 4/5.", d: "EASY" },
  { t: "Trigonometry", q: "The value of sin 45° is", o: ["1/2", "√2/2", "√3/2", "1"], a: 1, e: "sin 45° = √2/2.", d: "MEDIUM" },
  { t: "Trigonometry", q: "The period of sin x is", o: ["π", "2π", "π/2", "1"], a: 1, e: "sin x repeats every 2π radians.", d: "MEDIUM" },
  { t: "Trigonometry", q: "tan θ is undefined when θ =", o: ["0°", "45°", "90°", "180°"], a: 2, e: "tan θ = sin θ / cos θ, and cos 90° = 0, so division by zero.", d: "MEDIUM" },
  { t: "Trigonometry", q: "If sin θ = 5/13 and θ is acute, then cos θ =", o: ["12/13", "5/12", "8/13", "13/12"], a: 0, e: "cos θ = √(1 − sin²θ) = √(1 − 25/169) = √(144/169) = 12/13.", d: "MEDIUM" },
  { t: "Trigonometry", q: "cos(−x) is equal to", o: ["−cos x", "sin x", "cos x", "−sin x"], a: 2, e: "Cosine is an even function: cos(−x) = cos x.", d: "MEDIUM" },
  { t: "Trigonometry", q: "The value of sin 180° is", o: ["−1", "0", "1", "1/2"], a: 1, e: "sin 180° = 0.", d: "EASY" },
  { t: "Trigonometry", q: "π radians is equal to", o: ["90°", "180°", "270°", "360°"], a: 1, e: "π radians = 180°.", d: "EASY" },

  // ── Functions (14) ───────────────────────────────────────────────────
  { t: "Functions", q: "If f(x) = 2x + 3, then f(4) =", o: ["8", "10", "11", "14"], a: 2, e: "2(4) + 3 = 11.", d: "EASY" },
  { t: "Functions", q: "If f(x) = x², then f(−3) =", o: ["−9", "6", "9", "−6"], a: 2, e: "(−3)² = 9.", d: "EASY" },
  { t: "Functions", q: "The domain of √(x − 2) is", o: ["x > 2", "x ≥ 2", "x ≤ 2", "all real x"], a: 1, e: "The expression under the root must be ≥ 0: x − 2 ≥ 0 → x ≥ 2.", d: "MEDIUM" },
  { t: "Functions", q: "If f(x) = 3x − 1, then f(0) =", o: ["−1", "0", "1", "3"], a: 0, e: "3(0) − 1 = −1.", d: "EASY" },
  { t: "Functions", q: "The range of f(x) = x² for real x is", o: ["x ≥ 0", "y ≥ 0", "y > 0", "all real numbers"], a: 1, e: "Squares are never negative, so y ≥ 0.", d: "MEDIUM" },
  { t: "Functions", q: "If f(x) = x + 1 and g(x) = 2x, then f(g(3)) =", o: ["6", "7", "8", "9"], a: 1, e: "g(3) = 6, then f(6) = 6 + 1 = 7.", d: "MEDIUM" },
  { t: "Functions", q: "The inverse of f(x) = 2x + 5 is", o: ["(x − 5)/2", "2x − 5", "(x + 5)/2", "x/2 + 5"], a: 0, e: "Swap x and y: x = 2y + 5 → y = (x − 5)/2.", d: "MEDIUM" },
  { t: "Functions", q: "f(x) = 1/(x − 3) is undefined at", o: ["x = 0", "x = 1", "x = 3", "x = −3"], a: 2, e: "The denominator becomes zero at x = 3.", d: "EASY" },
  { t: "Functions", q: "If f(x) = |x|, then f(−5) =", o: ["5", "−5", "10", "−10"], a: 0, e: "Absolute value gives magnitude: |−5| = 5.", d: "EASY" },
  { t: "Functions", q: "f(x) = 3ˣ is an example of a", o: ["linear function", "quadratic function", "exponential function", "constant function"], a: 2, e: "The variable appears in the exponent, which defines exponential growth.", d: "EASY" },
  { t: "Functions", q: "The graph of a linear function is", o: ["a straight line", "a parabola", "a circle", "an irregular curve"], a: 0, e: "Linear functions have degree 1, so their graph is a straight line.", d: "EASY" },
  { t: "Functions", q: "The zeros of f(x) = x² − 4 are", o: ["x = 2 only", "x = −2 only", "x = 2 and x = −2", "x = 4"], a: 2, e: "x² = 4 gives x = ±2.", d: "MEDIUM" },
  { t: "Functions", q: "If g(x) = 4x − 2, then g(1) =", o: ["2", "4", "6", "−6"], a: 0, e: "4(1) − 2 = 2.", d: "EASY" },
  { t: "Functions", q: "For y = 5x + 2, the rate of change is", o: ["2", "5", "7", "1/5"], a: 1, e: "The rate of change (slope) is the coefficient of x: 5.", d: "EASY" },

  // ── Statistics (10) ──────────────────────────────────────────────────
  { t: "Statistics", q: "What is the mean of 2, 4, 6, 8, 10?", o: ["5", "6", "7", "8"], a: 1, e: "Sum = 30; 30 ÷ 5 = 6.", d: "EASY" },
  { t: "Statistics", q: "What is the median of 3, 1, 4, 2, 5?", o: ["2", "3", "4", "5"], a: 1, e: "Sorted: 1, 2, 3, 4, 5 — the middle value is 3.", d: "EASY" },
  { t: "Statistics", q: "What is the mode of 2, 2, 3, 4, 2?", o: ["2", "3", "4", "5"], a: 0, e: "2 appears three times, more than any other value.", d: "EASY" },
  { t: "Statistics", q: "What is the range of 5, 9, 2, 11?", o: ["6", "7", "9", "13"], a: 2, e: "Range = maximum − minimum = 11 − 2 = 9.", d: "EASY" },
  { t: "Statistics", q: "The mean of 5, 5, 5, 5 is", o: ["0", "4", "5", "20"], a: 2, e: "All values are equal to 5, so the mean is 5.", d: "EASY" },
  { t: "Statistics", q: "What is the median of 1, 3, 3, 7, 9, 11?", o: ["3", "4", "5", "7"], a: 2, e: "Even count: average of the 3rd and 4th values = (3 + 7)/2 = 5.", d: "MEDIUM" },
  { t: "Statistics", q: "The probability of getting a head with a fair coin is", o: ["1/4", "1/2", "1", "0"], a: 1, e: "One favourable outcome out of two equally likely outcomes.", d: "EASY" },
  { t: "Statistics", q: "What is the population variance of 2, 4, 6?", o: ["8/3", "2", "3", "4"], a: 0, e: "Mean = 4; variance = [(2−4)² + (4−4)² + (6−4)²]/3 = 8/3.", d: "MEDIUM" },
  { t: "Statistics", q: "The sum of the first 10 natural numbers is", o: ["45", "50", "55", "60"], a: 2, e: "n(n + 1)/2 = 10 × 11 / 2 = 55.", d: "EASY" },
  { t: "Statistics", q: "The probability of rolling a 6 on a fair die is", o: ["1/6", "1/5", "1/4", "1/3"], a: 0, e: "One favourable face out of six equally likely faces.", d: "EASY" },

  // ── Other (10) ───────────────────────────────────────────────────────
  { t: "Other", q: "What is 15% of ₦200?", o: ["₦20", "₦30", "₦35", "₦40"], a: 1, e: "0.15 × 200 = 30.", d: "EASY" },
  { t: "Other", q: "Simplify 12/16", o: ["1/2", "3/4", "4/5", "2/3"], a: 1, e: "Divide numerator and denominator by 4: 12/16 = 3/4.", d: "EASY" },
  { t: "Other", q: "Evaluate 7! ÷ 5!", o: ["7", "21", "42", "5040"], a: 2, e: "7! = 7 × 6 × 5!, so 7!/5! = 7 × 6 = 42.", d: "MEDIUM" },
  { t: "Other", q: "A car travels 60 km in 1.5 hours. Its average speed is", o: ["30 km/h", "40 km/h", "45 km/h", "90 km/h"], a: 1, e: "Speed = distance ÷ time = 60 ÷ 1.5 = 40 km/h.", d: "EASY" },
  { t: "Other", q: "2⁴ × 2³ =", o: ["2⁷ = 128", "2⁶ = 64", "4⁷", "2¹²"], a: 0, e: "When multiplying powers of the same base, add the exponents: 2⁷ = 128.", d: "MEDIUM" },
  { t: "Other", q: "3/4 expressed as a percentage is", o: ["34%", "66%", "75%", "80%"], a: 2, e: "0.75 × 100% = 75%.", d: "EASY" },
  { t: "Other", q: "Simple interest on ₦1,000 at 5% per year for 2 years is", o: ["₦50", "₦100", "₦150", "₦200"], a: 1, e: "I = P × R × T = 1000 × 0.05 × 2 = ₦100.", d: "MEDIUM" },
  { t: "Other", q: "The next prime number after 13 is", o: ["14", "15", "16", "17"], a: 3, e: "14, 15 and 16 are composite; 17 is prime.", d: "EASY" },
  { t: "Other", q: "√144 =", o: ["10", "11", "12", "14"], a: 2, e: "12 × 12 = 144.", d: "EASY" },
  { t: "Other", q: "The LCM of 4 and 6 is", o: ["2", "10", "12", "24"], a: 2, e: "Multiples of 4: 4, 8, 12, …; multiples of 6: 6, 12, … — smallest common is 12.", d: "EASY" },
];

export const CSC_TOPICS = [
  "Computing Fundamentals",
  "Computer Hardware",
  "Software Systems",
  "Data Representation",
] as const;

/** Format A (35Q) quota: 10 / 8 / 8 / 9. */
export const CSC_QUOTA_A: Record<string, number> = {
  "Computing Fundamentals": 10,
  "Computer Hardware": 8,
  "Software Systems": 8,
  "Data Representation": 9,
};

export const CSC_QUESTIONS: DemoQuestionSeed[] = [
  // ── Computing Fundamentals (10) ──────────────────────────────────────
  { t: "Computing Fundamentals", q: "CPU stands for", o: ["Central Processing Unit", "Computer Personal Unit", "Central Power Unit", "Control Program Unit"], a: 0, e: "CPU = Central Processing Unit, the component that executes instructions.", d: "EASY" },
  { t: "Computing Fundamentals", q: "The program that loads when a computer starts and manages all other software is the", o: ["Web browser", "Operating system", "Word processor", "Media player"], a: 1, e: "The operating system initialises the system and hosts all other applications.", d: "EASY" },
  { t: "Computing Fundamentals", q: "1 byte is equal to", o: ["4 bits", "8 bits", "16 bits", "1024 bits"], a: 1, e: "By definition, 1 byte = 8 bits.", d: "EASY" },
  { t: "Computing Fundamentals", q: "Which of these is an input device?", o: ["Keyboard", "Monitor", "Speaker", "Printer"], a: 0, e: "A keyboard enters data into the computer; the others are output devices.", d: "EASY" },
  { t: "Computing Fundamentals", q: "Memory that loses its contents when power is turned off is called", o: ["Volatile memory", "Permanent memory", "Secondary storage", "Non-volatile memory"], a: 0, e: "RAM is volatile: its contents disappear when power is lost.", d: "EASY" },
  { t: "Computing Fundamentals", q: "Using the binary convention, 1 GB equals how many MB?", o: ["100 MB", "512 MB", "1024 MB", "2048 MB"], a: 2, e: "In binary usage, 1 GB = 1024 MB.", d: "EASY" },
  { t: "Computing Fundamentals", q: "The ALU is responsible for", o: ["arithmetic and logic operations", "storing files permanently", "displaying images on screen", "connecting to networks"], a: 0, e: "The Arithmetic-Logic Unit performs calculations and comparisons.", d: "MEDIUM" },
  { t: "Computing Fundamentals", q: "Who is widely regarded as the first computer programmer?", o: ["Ada Lovelace", "Charles Babbage", "Alan Turing", "Bill Gates"], a: 0, e: "Ada Lovelace wrote the first published algorithm intended for a machine.", d: "MEDIUM" },
  { t: "Computing Fundamentals", q: "WWW stands for", o: ["World Wide Web", "Wireless Web World", "World Web Wire", "Wide World Web"], a: 0, e: "WWW = World Wide Web, the system of interlinked web pages.", d: "EASY" },
  { t: "Computing Fundamentals", q: "Which component holds data long-term inside the computer?", o: ["Hard disk", "RAM", "ALU", "Cache"], a: 0, e: "Secondary storage such as a hard disk retains data without power.", d: "EASY" },

  // ── Computer Hardware (8) ────────────────────────────────────────────
  { t: "Computer Hardware", q: "RAM stands for", o: ["Random Access Memory", "Read Available Memory", "Random Available Memory", "Ready Access Memory"], a: 0, e: "RAM = Random Access Memory, the computer's working memory.", d: "EASY" },
  { t: "Computer Hardware", q: "Which memory retains its contents even without power?", o: ["RAM", "ROM", "Cache", "Register"], a: 1, e: "ROM is non-volatile and keeps its contents without power.", d: "EASY" },
  { t: "Computer Hardware", q: "The main circuit board of a computer is the", o: ["Motherboard", "Hard drive", "Optical drive", "Power supply"], a: 0, e: "The motherboard connects the CPU, memory, storage and peripherals.", d: "EASY" },
  { t: "Computer Hardware", q: "GPU stands for", o: ["Graphics Processing Unit", "General Processing Unit", "Graphics Power Unit", "Global Processing Unit"], a: 0, e: "GPU = Graphics Processing Unit, specialised for rendering images.", d: "EASY" },
  { t: "Computer Hardware", q: "Processor clock speed is measured in", o: ["Kilobytes (KB)", "Gigahertz (GHz)", "Amperes (A)", "Bits per pixel"], a: 1, e: "Clock speed counts cycles per second, expressed in GHz for modern CPUs.", d: "EASY" },
  { t: "Computer Hardware", q: "The fastest memory in a computer is", o: ["Cache", "Hard disk", "Optical disc", "Flash drive"], a: 0, e: "CPU cache sits closest to the processor and has the lowest latency.", d: "MEDIUM" },
  { t: "Computer Hardware", q: "USB stands for", o: ["Universal Serial Bus", "United System Bus", "Universal Storage Board", "Ultra Speed Bus"], a: 0, e: "USB = Universal Serial Bus, a standard for connectors and cables.", d: "EASY" },
  { t: "Computer Hardware", q: "Which component produces the images shown on a monitor?", o: ["GPU", "SSD", "PSU", "NIC"], a: 0, e: "The GPU renders graphics that the monitor displays.", d: "MEDIUM" },

  // ── Software Systems (8) ─────────────────────────────────────────────
  { t: "Software Systems", q: "Which of these is system software?", o: ["Web browser", "Operating system", "Photo editor", "Video player"], a: 1, e: "An operating system manages hardware and provides a platform for applications.", d: "EASY" },
  { t: "Software Systems", q: "Microsoft Word is classified as", o: ["Application software", "System software", "Firmware", "Bootloader"], a: 0, e: "Word is an end-user application, not part of the operating system.", d: "EASY" },
  { t: "Software Systems", q: "The core of an operating system is called the", o: ["Compiler", "Kernel", "Spreadsheet", "Emulator"], a: 1, e: "The kernel controls memory, processes and hardware interaction.", d: "MEDIUM" },
  { t: "Software Systems", q: "An example of an open-source operating system is", o: ["Linux", "macOS", "Windows", "iOS"], a: 0, e: "Linux is developed and distributed as open source.", d: "EASY" },
  { t: "Software Systems", q: "A bug in software is", o: ["an error or flaw in the code", "a hardware failure", "a computer virus", "a network outage"], a: 0, e: "A bug is a defect in the program that produces wrong behaviour.", d: "EASY" },
  { t: "Software Systems", q: "A compiler is used to", o: ["compress files automatically", "connect to the internet", "translate high-level code to machine code", "clean the screen"], a: 2, e: "Compilers translate source code into executable machine code before running.", d: "MEDIUM" },
  { t: "Software Systems", q: "Malicious software is generally called", o: ["Freeware", "Malware", "Shareware", "Openware"], a: 1, e: "Malware is the umbrella term for viruses, trojans, spyware, etc.", d: "EASY" },
  { t: "Software Systems", q: "Software used to store and retrieve structured data is a", o: ["Browser", "Compiler", "DBMS", "Debugger"], a: 2, e: "A Database Management System (e.g. MySQL) stores and queries structured data.", d: "MEDIUM" },

  // ── Data Representation (9) ──────────────────────────────────────────
  { t: "Data Representation", q: "The basic unit of binary data is the", o: ["Bit", "Byte", "Nibble", "Pixel"], a: 0, e: "A bit is a single binary digit: 0 or 1.", d: "EASY" },
  { t: "Data Representation", q: "The decimal number 15 in binary is", o: ["1010", "1100", "1111", "1110"], a: 2, e: "15 = 8 + 4 + 2 + 1 = 1111.", d: "EASY" },
  { t: "Data Representation", q: "The binary number 1101 equals which decimal number?", o: ["11", "13", "14", "15"], a: 1, e: "8 + 4 + 0 + 1 = 13.", d: "EASY" },
  { t: "Data Representation", q: "How many symbols are there in the hexadecimal system?", o: ["8", "10", "16", "18"], a: 2, e: "Hexadecimal uses 16 symbols: 0–9 and A–F.", d: "EASY" },
  { t: "Data Representation", q: "Standard ASCII uses how many bits per character?", o: ["4 bits", "7 bits", "16 bits", "32 bits"], a: 1, e: "Standard ASCII defines 128 characters, requiring 7 bits.", d: "MEDIUM" },
  { t: "Data Representation", q: "A signed 8-bit integer can range from", o: ["0 to 255", "−128 to 127", "−256 to 255", "0 to 511"], a: 1, e: "One bit is the sign; the remaining 7 give 128 values each side.", d: "MEDIUM" },
  { t: "Data Representation", q: "Overflow occurs when", o: ["a value exceeds the storage capacity", "the computer overheats", "two files share a name", "memory is cleared"], a: 0, e: "Overflow is produced when a number is too large for its allocated bits.", d: "MEDIUM" },
  { t: "Data Representation", q: "A combination of text, audio, images and video is called", o: ["Multimedia", "Database", "Spreadsheet", "Firmware"], a: 0, e: "Multimedia integrates several media types together.", d: "EASY" },
  { t: "Data Representation", q: "In a typical RGB image, each colour channel uses", o: ["1 byte (8 bits)", "1 bit in total", "4 bytes", "16 bits"], a: 0, e: "Standard 24-bit RGB allots 8 bits (one byte) per channel.", d: "EASY" },
];
