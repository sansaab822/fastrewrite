// api/rewrite.js - Vercel Serverless Function with Gemini API

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url, type, style, customPrompt } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    // Step 1: Fetch content from URL
    const articleContent = await fetchArticleContent(url);
    
    if (!articleContent) {
      return res.status(400).json({ error: 'Failed to fetch content from URL' });
    }

    // Step 2: Rewrite with Gemini API
    const rewrittenContent = await rewriteWithGemini(articleContent, type, style, customPrompt);

    return res.status(200).json({
      success: true,
      content: rewrittenContent,
      originalLength: articleContent.length,
      rewrittenLength: rewrittenContent.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}

async function fetchArticleContent(url) {
  // Try multiple CORS proxies
  const proxies = [
    `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
    `https://corsproxy.io/?${encodeURIComponent(url)}`,
    `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`
  ];

  for (const proxy of proxies) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      
      const response = await fetch(proxy, { 
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) continue;

      let text;
      
      if (proxy.includes('allorigins')) {
        const data = await response.json();
        text = data.contents;
      } else {
        text = await response.text();
      }

      if (!text || text.length < 100) continue;

      // Parse HTML and extract clean text
      const cleanText = extractTextFromHTML(text);
      return cleanText.substring(0, 5000); // Limit to 5000 chars

    } catch (error) {
      console.log(`Proxy failed: ${proxy}`, error.message);
      continue;
    }
  }
  
  return null;
}

function extractTextFromHTML(html) {
  // Simple HTML to text extraction
  let text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim();

  return text;
}

async function rewriteWithGemini(content, type, style, customPrompt) {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY not configured');
  }

  const typeNames = {
    job: 'Latest Job / Recruitment Notification',
    admit_card: 'Admit Card Release',
    result: 'Exam Result Declaration',
    answer_key: 'Answer Key Release',
    syllabus: 'Exam Syllabus & Pattern'
  };

  const styleInstructions = {
    conversational: 'Bilkul conversational tone mein likhein jaise koi dost bata raha ho. "Doston", "Aap", "Suniye" jaise words use karein. Friendly aur warm tone ho.',
    professional: 'Professional aur formal tone mein likhein, lekin boring na lage. Information clear aur structured ho.',
    youtube: 'Energetic YouTube style mein likhein - excitement ho, emojis zyada use karein, "Guys", "Finally", "Leaked" jaise words use karein. Thoda dramatic tone ho.',
    blog: 'Detailed blog post style mein likhein - comprehensive information ho, har point cover karein, informative aur helpful tone ho.'
  };

  const prompt = `Aap FastNaukriAlert.com ke senior content writer hain. Aapko 5 saal ka experience hai government job notifications likhne ka.

**ORIGINAL CONTENT:**
${content}

**ARTICLE TYPE:** ${typeNames[type] || 'Government Notification'}

**WRITING STYLE:** ${styleInstructions[style] || styleInstructions.conversational}

${customPrompt ? `**CUSTOM INSTRUCTIONS:** ${customPrompt}` : ''}

---

**DETAILED INSTRUCTIONS:**

1. **Opening (Hook):**
   - Catchy headline with emoji
   - Friendly greeting: "Hello doston!", "Namaste!", "Hey guys!"
   - Excitement dikhayein: "Finally wait khatam!", "Ek badi khabar!", "Golden opportunity!"

2. **Content Structure:**
   \`\`\`
   🎯 Headline with Emoji
   
   👋 Friendly Intro (Personal touch ke saath)
   
   📋 Quick Overview Table:
   | Detail | Information |
   
   📅 Important Dates Table
   
   💰 Application Fee Structure
   
   🎓 Eligibility Criteria (Age, Qualification)
   
   📝 Selection Process (Step-by-step)
   
   🖥️ How to Apply (Detailed steps)
   
   🔗 Important Links
   
   💡 Preparation Tips / Pro Tips
   
   ❓ FAQs (3-4 common questions)
   
   ⚠️ Disclaimer
   
   🎉 Motivational Ending
   \`\`\`

3. **Language Rules:**
   - **Natural Hindi** jaise baat cheet ho
   - **Technical terms English mein:** Online Application, Registration, Admit Card, Syllabus, Exam Pattern, Selection Process, Document Verification, Eligibility, Vacancy, Age Limit, Application Fee, Cut Off, Merit List, Qualification
   - **Hinglish mix:** "Online form bharne hain", "Last date yaad rakhna", "Admit card download karna"
   - **Conversational words:** "Dekhiye", "Samajh lijiye", "Sochiye", "Baat karein"

4. **Human Elements (Zarur add karein):**
   - "Maine khud check kiya hai..."
   - "Aap jaante hain ki..."
   - "Ek baat aur yaad rakhna..."
   - "Trust me, yeh important hai..."
   - "Mere hisaab se..."
   - "Aap sochenge ki..."

5. **Formatting:**
   - Tables for structured data (dates, fees, eligibility)
   - Bullet points for lists
   - Bold headings with emojis
   - Short paragraphs (2-3 lines max)
   - White space maintain karein

6. **What NOT to do:**
   - ❌ "This is to inform that..." (Bilkul nahi)
   - ❌ Pure formal Hindi (राजभाषा style)
   - ❌ Long boring paragraphs
   - ❌ Robotic language
   - ❌ Copy-paste from source

7. **Uniqueness:**
   - 100% original rewrite
   - Source se koi sentence match nahi hona chahiye
   - Apne words mein present karein
   - Fresh perspective ho

**OUTPUT:** Sirf rewritten content, koi extra explanation nahi. Content ready-to-publish hona chahiye.`;

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        temperature: 0.8,
        topP: 0.95,
        maxOutputTokens: 2500
      }
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Gemini API error');
  }

  const data = await response.json();
  
  if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
    throw new Error('Invalid response from Gemini API');
  }

  return data.candidates[0].content.parts[0].text;
}

