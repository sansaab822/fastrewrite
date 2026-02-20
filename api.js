// api/rewrite.js - Vercel Serverless Function

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url, type, customFormat } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    // Fetch content from URL
    const fetch = (await import('node-fetch')).default;
    
    // Try multiple proxies
    const proxies = [
      `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
      `https://corsproxy.io/?${encodeURIComponent(url)}`
    ];

    let content = null;
    
    for (const proxy of proxies) {
      try {
        const response = await fetch(proxy, { timeout: 10000 });
        const data = await response.json();
        if (data.contents) {
          content = data.contents;
          break;
        }
      } catch (e) {
        continue;
      }
    }

    if (!content) {
      return res.status(400).json({ error: 'Failed to fetch content' });
    }

    // Call OpenAI API
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [{
          role: 'user',
          content: createPrompt(content, type, customFormat)
        }],
        temperature: 0.7,
        max_tokens: 2000
      })
    });

    const aiData = await openaiResponse.json();
    const rewrittenContent = aiData.choices[0].message.content;

    return res.status(200).json({
      success: true,
      content: rewrittenContent,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

function createPrompt(content, type, customFormat) {
  const typeNames = {
    job: 'Latest Job / Recruitment',
    admit_card: 'Admit Card Release',
    result: 'Exam Result Declaration',
    answer_key: 'Answer Key Release',
    syllabus: 'Exam Syllabus & Pattern'
  };

  return `Aap ek professional content writer hain jo FastNaukriAlert website ke liye job-related articles likhte hain.

Original Content: ${content.substring(0, 3000)}

Article Type: ${typeNames[type] || 'Notification'}

Instructions:
1. Content ko natural, conversational Hindi mein rewrite karein (jaise ek real human likhta hai)
2. Technical words jaise "Online Application", "Registration", "Admit Card", "Syllabus", "Exam Pattern", "Selection Process", "Qualification", "Vacancy", "Age Limit" ko English mein hi rakhein
3. Content 100% unique aur plagiarism-free hona chahiye
4. AI-generated na lage, bilkul human-written style mein ho
5. Important information ko highlight karein (dates, fees, eligibility)
6. Content engaging aur easy-to-read ho
${customFormat ? '7. Custom Format follow karein: ' + customFormat : ''}

Output sirf rewritten content hi hona chahiye.`;
  }
                                   
