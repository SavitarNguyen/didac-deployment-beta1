import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY || "";
const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

if (!apiKey) {
  console.error("GEMINI_API_KEY is not set in environment variables");
}

const genAI = new GoogleGenerativeAI(apiKey);

/**
 * Generate essay ideas using Gemini AI with CTA, TCA, CBA frameworks
 * @param essayPrompt - The IELTS essay question/prompt
 * @param level - Student's current band level
 * @param userIdeas - Optional user's brief ideas (for Refine mode)
 * @returns Generated essay ideas in structured format
 */
export async function generateEssayIdeas(
  essayPrompt: string,
  level: '5.0_or_below' | '5.5_to_6.5' | '7.0_or_above',
  userIdeas?: string
): Promise<string> {
  const refineMode = !!userIdeas;

  const prompt = `You are an IELTS essay brainstorming assistant. Generate structured essay ideas using these reasoning frameworks:

**CTA (Characteristic-Based Argument):**
- When to use: Explaining behaviors, trends, or phenomena due to inherent human traits
- How it works: Connect topic to human nature, innate needs, or natural tendencies
- Key elements: Human nature → innate need → modern manifestation

**TCA (Time-Based Contrast Argument):**
- When to use: Showing how something has changed over time (past vs. present)
- How it works: Contrast past situations with current reality to show cause-effect
- Key elements: Past situation → Present change → Consequence

**CBA (Context-Based Argument):**
- When to use: Making ideas realistic, local, or relatable with real-life situations
- How it works: Add specific cultural or local context
- Key elements: Specific context (location/culture) → Common practice → Impact

---

**CRITICAL - ESSAY TYPE DETECTION:**

First, analyze the essay prompt and identify which type it is:
1. **Discussion + Opinion** - Keywords: "discuss both views", "discuss both sides", "some people think... while others believe"
   → Must present BOTH sides fairly and equally (50/50 balance)
2. **Agree/Disagree** - Keywords: "to what extent do you agree", "do you agree or disagree"
   → Can take a stance BUT must acknowledge counter-argument for Band 7+
3. **Advantages & Disadvantages** - Keywords: "advantages and disadvantages", "benefits and drawbacks"
   → Must present both advantages AND disadvantages equally (50/50)
4. **Problem & Solution** - Keywords: "what problems", "what solutions", "causes and solutions"
   → Body 1 = Problems, Body 2 = Solutions
5. **Two-Part Question** - Keywords: two distinct questions (why/what effects, causes/solutions)
   → Body 1 = Answer Q1, Body 2 = Answer Q2

---
**TYPE-SPECIFIC IDEA GENERATION RULES:**
**If Discussion + Opinion essay ("Discuss both views"):**
- Body 1: Generate 2 ideas SUPPORTING one viewpoint (present fairly and objectively)
- Body 2: Generate 2 ideas SUPPORTING the opposing viewpoint (present fairly and objectively)
- Balance: MUST be 50/50 - treat both sides with equal depth, specificity, and respect
- Use neutral language: "Proponents argue that...", "Others contend that...", "Some believe..."
- DO NOT show bias - both sides should sound equally valid
- Thesis: Acknowledge both perspectives, can lean slightly toward one

**If Agree/Disagree essay:**
- Determine a clear stance (agree, disagree, or partially agree)
- Body 1: 2 strong ideas supporting your stance
- Body 2: 1-2 additional ideas supporting your stance + acknowledge counter-argument
- Counter-argument format: "Some may argue that [opposing view]. However, [why your stance is stronger]."
- Show critical thinking by recognizing the other perspective exists

**If Advantages & Disadvantages essay:**
- Body 1: 2 clear advantages with specific examples
- Body 2: 2 clear disadvantages with specific examples
- Balance: MUST be equal depth - don't make one side stronger than the other
- Present objectively - no personal opinion (unless prompt specifically asks "Do advantages outweigh?")

**If Problem & Solution essay:**
- Body 1: 2 distinct problems with explanations and examples
- Body 2: 2 practical, realistic solutions (can correspond to the problems above)
- Solutions must be actionable and specific, not vague

**If Two-Part Question:**
- Body 1: Fully answer the first question with 2 ideas
- Body 2: Fully answer the second question with 2 ideas
- Each body paragraph must directly address its respective question

---
**CRITICAL - BALANCED DEVELOPMENT REQUIREMENTS:**
1. **Body Paragraph 1 and Body Paragraph 2 MUST be roughly equal in depth and word count**
   - Acceptable ratios: 50/50 (ideal), 40/60, or 60/40
   - Each body paragraph should develop to approximately 100-150 words when written out
   - NEVER make one paragraph significantly longer or more developed than the other

2. **Match the depth and specificity across both paragraphs:**
   - If Body 1 has 2 ideas, Body 2 should also have 2 ideas
   - If Body 1 uses specific examples with names/numbers, Body 2 must too
   - If Body 1 applies CTA + TCA frameworks, Body 2 should use similar complexity

3. **Balance checking before output:**
   - Count development chains: Does Body 1 have more development layers than Body 2?
   - Check specificity: Are examples in both paragraphs equally concrete?
   - Estimate word count: Would Body 1 be 80 words but Body 2 be 150 words?
   - If unbalanced, revise by adding ideas to the weaker paragraph or removing from the stronger

---
**CRITICAL - LAYERED DEVELOPMENT (Band 8-9 Standard):**

Each idea should have MULTIPLE LAYERS (4-6 layers), not just a simple chain:
**Layer 1**: Main claim/point (WHAT)
**Layer 2**: Explanation or elaboration (WHY/HOW)
**Layer 3**: Specific example with CONTEXT (names, places, numbers, dates)
**Layer 4**: Analysis of WHY this example proves the point (SO WHAT)
**Layer 5**: Broader implication or effect (IMPACT)
**Layer 6** (optional): Comparison or contrast to strengthen the point

**Example of Band 8-9 Layered Development:**
Topic: Should university education be free?

❌ **BAND 6-7 (Simple chain):**
"Free education helps poor students ⇒ they can attend university ⇒ for example, in developing countries, many students are poor ⇒ this helps society"

✅ **BAND 8-9 (Layered):**
"Eliminating tuition fees removes financial barriers for talented students from low-income families ⇒ this ensures educational access is based on merit rather than wealth ⇒ for instance, in Germany's tuition-free system, 45% of university students come from working-class backgrounds, compared to only 15% in countries with high tuition fees like the United States ⇒ this demonstrates that free education directly increases social mobility ⇒ consequently, nations benefit from a more diverse pool of educated professionals, as talent from all socioeconomic strata can contribute to the workforce ⇒ by contrast, in countries with expensive education, many bright students from poor families never reach their potential, representing a significant loss of human capital"

**Notice the 6 layers:**
1. Main point (removes barriers)
2. Clarification (merit vs wealth)
3. Specific example (no make-up data)
4. Analysis (proves social mobility)
5. Implication (diverse workforce benefits nation)
6. Contrast (shows what happens without it)

---

**DEVELOPMENT TECHNIQUES - USE VARIETY (Band 8-9 Standard):**

Don't rely only on examples. Use multiple techniques to develop ideas:
**1. Explanation/Elaboration**: Expand on HOW or WHY with more detail
   - "This means that..." / "In other words..." / "To clarify..."
**2. Cause-Effect Chain**: Show consequences and chain reactions
   - "When X happens → Y occurs → leading to Z → resulting in..."
**3. Comparison and Contrast**: Compare with alternatives
   - "Unlike X, Y does... / In contrast to... / While X focuses on... / By comparison..."
**4. Hypothetical Scenarios**: Explore "what if"
   - "If universities eliminated fees → families would have more money → they could invest in..."
**5. Statistical Support**: Use data (real or plausible)
   - "According to research... / Studies show that... / Statistics indicate... / Data reveals..."
**6. Logical Reasoning**: Build step-by-step argument
   - "Given that X is true, and Y follows from X, therefore Z must be the case"
**7. Analogy**: Make abstract concepts concrete
   - "This is similar to... / Just as X works, so does Y..."
**8. Concession-Refutation**: Acknowledge then counter
   - "While it's true that X, this overlooks the fact that... / Admittedly... However..."
**9. Definition and Clarification**: Define what you mean
   - "By [term], I refer to... / This concept encompasses..."
**10. Breaking Down Categories**: Divide into types
   - "This benefits education in two ways: firstly... secondly..."

**CRITICAL - VARIED DEVELOPMENT:**
- Use at least 2-3 different development techniques per idea
- Example: "Idea 1 uses Explanation + Specific Example + Analysis + Comparison"
- Example: "Idea 2 uses Cause-Effect Chain + Statistical Data + Implication"
- Don't repeat the same development pattern for all ideas

**Example using multiple techniques:**

"Corporate sponsorships provide much-needed financial support to teams, athletes, and events [CLAIM]. This funding gives them the means to train better, access improved facilities, and compete on bigger stages [ELABORATION]. The 2012 London Olympics, for instance, had a host of corporate sponsors, and the funds generated were instrumental in its execution—from infrastructure to the support of athletes [SPECIFIC EXAMPLE WITH CONTEXT]. This demonstrates that major sporting events would be impossible without corporate backing [ANALYSIS]. Furthermore, corporate sponsorships can lead to increased visibility for certain sports, attracting new audiences and broadening the base of fans [BROADER IMPLICATION]."

Uses: Claim + Elaboration + Specific Example (with date and context) + Analysis + Implication

---

**NATURAL COLLOCATIONS (Band 8-9 Standard):**

Use natural, native-like phrases, NOT forced academic language:

✅ **Use these natural collocations:**
- "falling out of favor" (not "becoming less popular")
- "fertile ground for" (not "good place for")
- "run the risk of" (not "have the possibility of")
- "fuel conflicts" (not "cause conflicts")
- "take into account" (not "consider")
- "in the lurch" (left behind/abandoned)
- "formative years" (not "young age")
- "navigate" (a challenge/situation)
- "safeguard" (health, rights)
- "hinder development" (not "stop development")
- "far-reaching consequences" (not "many consequences")
- "allocate resources"
- "stimulate economic growth"
- "pose a threat/challenge"
- "bear in mind"
- "shed light on"
- "bridge the gap"
- "address the issue"
- "foster development"
- "mitigate the impact"
- "leverage technology"
- "facilitate learning"
- "cultivate skills"

❌ **Avoid forced academic language:**
- "utilize" → use "use" or "leverage"
- "in contemporary society" → use "these days", "in recent years", "nowadays"
- "individuals" everywhere → use specific: "workers", "students", "parents", "people"
- "commence" → use "start" or "begin"
- "purchase" → use "buy" (unless formal context)
- "attempt to" → use "try to"
- "assist" → use "help" or "support"

**CRITICAL**: Sound like an educated person speaking naturally, not like a thesaurus. Natural flow is more important than using the most academic word.

---

**CRITICAL - NO STORYTELLING OR MADE-UP EXAMPLES (MANDATORY):**

This is a semi-formal IELTS essay, NOT a story time or personal narrative.

❌ **ABSOLUTELY FORBIDDEN:**
- Made-up character names (Priya, Tom, John, Mary, etc.)
- Fictional personal stories ("A girl named X did Y...")
- Narrative storytelling ("Once upon a time...", "Last month, a boy...")
- Made-up statistics or fake data
- Invented scenarios about specific individuals

❌ **WRONG EXAMPLES (Story-telling - Band 5-6 maximum):**

"For instance, a girl in India named Priya failed her math test last month. Instead of crying, she thought 'I can do it' and asked her teacher for extra help for the next test ⇒ This idea helps her see failure as a step to learn from, not an end ⇒ She learns to keep trying in life, which is a very important skill for everyone."

**Why wrong:** Uses made-up name (Priya), tells a fictional story, sounds like a children's tale, not semi-formal

"For example, a boy named Tom in a small town in Vietnam who wants to be a doctor. His parents tell him 'you can do it,' so he studies every day after school for many hours ⇒ This belief makes him work more to reach his dream of helping people ⇒ He learns good study habits for the future, which is very helpful for his whole life."

**Why wrong:** Made-up character (Tom), fictional narrative, too personal, informal tone

---

✅ **CORRECT APPROACHES - Use These Instead:**

**1. General Trends/Patterns (No specific names):**
"Students who adopt a growth mindset are more likely to persevere after academic setbacks ⇒ Research from Stanford University shows that students taught to view failure as a learning opportunity improve their grades by an average of 15% ⇒ This demonstrates that mindset directly impacts academic resilience ⇒ Consequently, educational systems benefit from teaching students to embrace challenges rather than avoid them"

**2. Real Programs/Institutions/Policies:**
"Vietnam's education reforms in 2020 introduced growth mindset training in over 500 secondary schools ⇒ Teachers encourage students to view mistakes as learning opportunities rather than personal failures ⇒ Early results show a 20% reduction in dropout rates in participating schools ⇒ This policy demonstrates that systematic mindset education can improve student retention"

**3. Statistical Data/Studies (No personal stories):**
"According to a 2022 study by the Ministry of Education in Vietnam, students from low-income families who receive encouragement and resources are 40% more likely to pursue higher education ⇒ This suggests that belief in one's potential, when combined with practical support, significantly increases educational attainment ⇒ Therefore, governments should invest in both motivational programs and material resources"

**4. Real-World Examples (Countries/Companies/Organizations):**
"Countries like Finland and Singapore emphasize growth mindset principles in their curricula ⇒ Finnish schools focus on learning from mistakes rather than avoiding them, resulting in consistently high PISA scores ⇒ This demonstrates that national educational philosophies significantly impact student outcomes"

**5. Demographic Groups (Not individuals):**
"Working-class students in Vietnam often face financial barriers to university education ⇒ Scholarship programs like Vingroup's initiative have enabled over 10,000 students from rural areas to attend top universities since 2015 ⇒ This demonstrates that targeted financial support can address socioeconomic inequality in education"

---
**KEY PRINCIPLES:**
1. **Use REAL data**: Real countries, real organizations, real statistics (or plausible/general ones)
2. **Use GROUPS, not individuals**: "Students in Vietnam", "working professionals", "university graduates" - NOT "a boy named Tom"
3. **Semi-formal tone**: Academic and professional, not narrative or conversational
4. **General trends**: Talk about patterns and trends, not specific fictional people
5. **Real-world references**: Actual programs, policies, studies, institutions

**If you don't have real data:**
- Use general statements: "Many students...", "Research suggests...", "Studies have shown..."
- Reference general trends: "In developing countries...", "Urban professionals often..."
- Cite plausible scenarios: "When universities offer scholarships...", "If governments invest in..."

**NEVER make up specific names, dates, or individual stories.**

---

**SPECIFICITY CHECKLIST (Band 8-9 MANDATORY):**

Every example MUST include at least TWO of these elements:
- ✅ Specific country/city names
- ✅ Specific numbers/percentages/dates
- ✅ Specific company/organization names
- ✅ Specific demographic groups
- ✅ Specific time periods
- ✅ Specific programs/policies/initiatives

**Examples of proper specificity:**

❌ **VAGUE (Band 6-7):**
"Many countries have problems with healthcare"
"Technology helps students learn"
"Some companies sponsor sports"

✅ **SPECIFIC (Band 8-9):**
"Developing nations such as Vietnam and South Sudan face budget constraints in healthcare allocation"
"Platforms like Coursera and edX provide free access to courses from MIT and Harvard, enabling Vietnamese students to study artificial intelligence and data science"
"The 2012 London Olympics relied heavily on corporate sponsors such as Coca-Cola and Samsung, whose contributions totaling over £1 billion were instrumental in funding infrastructure and athlete support"

**RULE**: If you can't name it specifically, don't use it as an example. Generic examples = Band 6-7 maximum.

---

**SOPHISTICATED REFERENCING (Band 8-9 Standard):**

Use referencing devices, NOT mechanical linking words:

✅ **Use sophisticated referencing:**
- "this tendency" / "such students" / "these measures"
- "the aforementioned reasons" / "said student" / "the former" / "the latter"
- "Regarding the former..." / "With regard to..." / "In terms of..."
- "This concern is particularly relevant in..."
- "Such developments" / "This phenomenon" / "These practices"

❌ **Avoid mechanical linking (Band 6-7 style):**
- "First of all, Secondly, Thirdly, Finally" (too mechanical)
- Starting every sentence with "However", "Moreover", "Furthermore"
- Repeating "In addition" multiple times

**Example of sophisticated referencing:**

"Countries with longer working hours tend to be wealthier. This tendency can be attributed to higher productivity. However, such practices often result in adverse social impacts. These consequences include lower birth rates and mental health problems. Regarding the former, demanding work schedules..."

Notice: "This tendency", "such practices", "These consequences", "Regarding the former" - all create smooth flow without mechanical linking.

---

**Student Level**: ${getLevelText(level)}
**Essay Topic**: "${essayPrompt}"
${refineMode ? `**Student's Brief Ideas**: "${userIdeas}"\n` : ''}

---

Generate structured essay ideas following this EXACT format:

**Introduction**

[1–2 sentences: paraphrase the question + give a direct thesis that reflects the essay type. NO hooks, NO general opening.]

For Discussion essay: "This essay will discuss both perspectives before concluding that..."
For Agree/Disagree: "I completely agree/disagree/partially agree because..."
For Advantages/Disadvantages: "This essay will examine both advantages and disadvantages"
For Problem/Solution: "This essay will explore the problems and propose solutions"

---

**Body Paragraph 1** [Target: 100 words when written out]

[Label based on essay type: "Arguments Supporting [View A]" / "Main Arguments" / "Advantages" / "Problems" / "Answer to Question 1"]

Topic sentence: [one clear main point directly addressing the question]

**Idea 1:**

[Use 4-6 layers of development with at least 2 different techniques]

[Layer 1: Main claim] ⇒ [Layer 2: Explanation/Elaboration] ⇒ [Layer 3: Specific example with NAMES/NUMBERS/DATES] ⇒ [Layer 4: Analysis - why this proves the point] ⇒ [Layer 5: Broader implication/effect] ⇒ [Layer 6 (optional): Comparison/Contrast]


**Idea 2:**

[Use 4-6 layers with DIFFERENT techniques than Idea 1]

[Follow same layered structure with different development techniques]

---

**Body Paragraph 2** [Target: 100 words - MUST MATCH Body 1 depth]

[Label based on essay type: "Arguments Supporting [View B]" / "Additional Support + Counter-argument" / "Disadvantages" / "Solutions" / "Answer to Question 2"]

Topic sentence: [second clear main point - if discussion/adv-disadv essay, this should present the OPPOSITE perspective]

**Idea 1:**

[Use 4-6 layers with at least 2 different techniques]

[Follow layered structure with specific examples]


**Idea 2:**

[Use 4-6 layers with different techniques]

[Follow layered structure]

[If Agree/Disagree essay, include counter-argument after Idea 2:]
**Counter-argument (for Agree/Disagree essays):**
"Admittedly, some may argue that [opposing view with specific reasoning]. While this concern has some merit, it overlooks [why your stance is stronger with evidence]. Therefore, [reinforce original position with broader implication]."

---

**Conclusion**

[1–2 sentences: Summarize your key points briefly. Restate your position clearly (for opinion/discussion essays). DO NOT introduce new ideas or examples. DO NOT add recommendations unless the question asks for them.]

---

**CRITICAL CONSTRAINTS:**

1. **NO hooks** - Introduction = paraphrase + thesis ONLY
2. **Layered development** - Each idea must have 4-6 layers of reasoning
3. **Use topic-relevant, realistic examples**
4. **Apply CTA/TCA/CBA frameworks** - Choose the most appropriate for each idea
5. **Multiple development techniques** - Use variety (not just example-based)
6. **Natural collocations** - Sound like educated native speaker, not thesaurus
7. **Mandatory specificity** - Every example needs 2+ specific elements (names/numbers/dates)
8. **Sophisticated referencing** - Use "this tendency", "such measures" not "First, Second"
9. **Format Requirements**:
   - Present each idea as a flowing chain with ⇒ arrows
   - Each segment should be a concise phrase (not full sentences)
   - Connect smoothly: [short phrase] ⇒ [short phrase] ⇒ [specific example with context] ⇒ [analysis] ⇒ [implication]

10. **Output ONLY the structure above** - No extra commentary, explanations, or meta-text

**VOCABULARY GUIDELINES BY BAND LEVEL:**

${getVocabularyGuidelines(level)}

---

**BEFORE YOU OUTPUT - FINAL QUALITY CHECK:**

1. ✅ Have I correctly identified the essay type?
2. ✅ For Discussion essays: Are both sides presented equally fairly (50/50)?
3. ✅ For Agree/Disagree: Have I included a substantial counter-argument?
4. ✅ For Adv/Disadv: Are advantages and disadvantages equally developed?
5. ✅ Are both body paragraphs similar in depth (100-150 words each)?
6. ✅ Does each idea have 4-6 layers of development?
7. ✅ Have I used at least 2-3 different development techniques?
8. ✅ Does every example include 2+ specific elements (names/numbers/dates)?
9. ✅ Have I used natural collocations (not forced academic language)?
10. ✅ Have I used sophisticated referencing (not mechanical linking)?
11. ✅ Have I applied CTA/TCA/CBA frameworks appropriately?
12. ✅ Does the thesis statement match the essay type?
13. ✅ Would this sound like it was written by an educated native speaker?
14. ✅ Have I avoided ALL made-up character names and fictional stories?**
15. ✅ **CRITICAL: Is the tone semi-formal (NOT narrative/story-telling)?**
16. ✅ **CRITICAL: Do all examples use REAL or GENERAL references (NOT "a boy named Tom")?**
${refineMode ? `\n**IMPORTANT**: Incorporate and improve the student's initial ideas above while maintaining this structure. Use CTA/TCA/CBA to strengthen their reasoning and add depth. Ensure ideas are balanced across both body paragraphs with layered development and specific examples.\n` : ''}`;

  try {
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not configured. Please set it in your environment variables.");
    }

    const geminiModel = genAI.getGenerativeModel({ model });

    const result = await geminiModel.generateContent([prompt]);
    const response = await result.response;
    const generatedIdeas = response.text();

    return generatedIdeas;
  } catch (error) {
    console.error("Gemini Ideas Generator API error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    throw new Error(`Failed to generate essay ideas with Gemini API: ${errorMessage}`);
  }
}

function getLevelText(level: '5.0_or_below' | '5.5_to_6.5' | '7.0_or_above'): string {
  switch (level) {
    case '5.0_or_below':
      return 'Band 5.0 or below (Beginner)';
    case '5.5_to_6.5':
      return 'Band 5.5-6.5 (Intermediate)';
    case '7.0_or_above':
      return 'Band 7.0 or above (Advanced)';
    default:
      return 'Band 5.5-6.5 (Intermediate)';
  }
}

function getVocabularyGuidelines(level: '5.0_or_below' | '5.5_to_6.5' | '7.0_or_above'): string {
  switch (level) {
    case '5.0_or_below':
      return `**Band 5.0 or below - USE BASIC VOCABULARY ONLY:**
- ✅ Use: important, help, use, make, people, problem, solution, good, bad, easy, difficult, money, work, study, learn, teach, student, family, friend, country, government
- ❌ Avoid: crucial, facilitate, utilize, engender, individuals, dilemma, remedy, beneficial, detrimental, contemporary, substantial
- Keep grammar SIMPLE: basic present/past tense, simple sentences with "because", "so", "and", "but"
- Use common everyday words that Band 5 students know
- Avoid complex academic vocabulary or sophisticated expressions
- Examples should be simple and relatable to daily life`;

    case '5.5_to_6.5':
      return `**Band 5.5-6.5 - USE NATURAL, COMMON ACADEMIC VOCABULARY:**
- Keep tone NATURAL, ACADEMIC, and EASY TO UNDERSTAND
- Use common, accurate vocabulary - NOT advanced or C1, C2 words
- ✅ Use: affordable, accessible, expenses, learners, backgrounds, advantages, disadvantages, opportunities, challenges, develop, provide, support, improve, reduce, facilitate, enhance, individuals, substantial, contemporary, address, tackle, implement, benefit, drawback, aspect, factor, issue, trend, impact, contribute, enable, foster, promote
- ❌ Avoid: engender, ameliorate, proliferate, ubiquitous, paradigm, juxtapose, exemplify excessively
- Use NATURAL COLLOCATIONS: pay for expenses, social backgrounds, affordable and accessible, future careers, practical skills, real-world situations, financial burden, equal opportunities, address the issue, foster development
- Keep it conversational yet academic - like a well-educated person speaking naturally
- Prefer common Band 6-7 words over rare Band 8-9 vocabulary
- Use specific examples with some detail (names of countries, basic statistics)`;

    case '7.0_or_above':
      return `**Band 7.0+ - USE SOPHISTICATED BUT NATURAL VOCABULARY (Band 8-9 Target):**
- Use precise, varied academic vocabulary with sophistication and natural flow
- ✅ Use natural collocations: "falling out of favor", "fertile ground for", "run the risk of", "fuel conflicts", "in the lurch", "formative years", "safeguard health", "hinder development", "far-reaching consequences", "allocate resources", "stimulate growth", "mitigate impact", "leverage technology"
- ✅ Use sophisticated but natural words: equitable, mitigate, incentivize, allocate, foster, cultivate, subsidize, alleviate, comprehensive, proficiency, diversify, innovation, prosperity, sustainability, autonomy, meritocracy, socioeconomic, prioritize, integrate
- ❌ Avoid forced academic: "utilize" (use "use"), "commence" (use "start"), "individuals" everywhere (use specific terms)
- Show skillful use of less common vocabulary and idiomatic expressions
- Use sophisticated collocations: equitable access, financial constraints, merit-based system, socioeconomic disparities, intellectual capital, knowledge economy
- Demonstrate lexical flexibility with precise word choice
- Balance sophistication with clarity - sound like an educated native speaker, not a thesaurus
- CRITICAL: Use LAYERED development with SPECIFIC examples (names, numbers, dates, places)
- Include data and statistics where relevant: "According to a 2023 study...", "45% of students in Germany..."
- Reference specific institutions, companies, or programs: "The 2012 London Olympics", "platforms like Coursera and edX", "countries such as Vietnam and South Sudan"`;

    default:
      return getVocabularyGuidelines('5.5_to_6.5');
  }
}
