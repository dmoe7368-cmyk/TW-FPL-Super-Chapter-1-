// js/csvParser.js

/**
 * Google Sheets မှ CSV ဒေတာများကို လှမ်းယူပြီး စစ်ဆေးပေးသော Function
 * @param {string} url - Google Sheets ၏ CSV Publish URL
 * @param {string} sheetName - Error ပြသရာတွင် အသုံးပြုရန် Sheet အမည်
 * @returns {Promise<{data: Array<Object>, error: string|null}>}
 */
export async function fetchCSV(url, sheetName) {
  if (!url || url.trim() === "") {
    return { data: [], error: `[${sheetName}] CSV Link ထည့်မထားပါ။ js/config.js ကို စစ်ဆေးပါ။` };
  }
  
  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      return { data: [], error: `[${sheetName}] HTTP Error: ${response.status}. Link မှားယွင်းနေပါသည်။` };
    }
    
    const csvText = await response.text();
    
    // HTML (Web Page) အဖြစ် အမှား Publish လုပ်ထားခြင်းကို စစ်ဆေးခြင်း
    if (csvText.toLowerCase().includes("<!doctype html>") || csvText.toLowerCase().includes("<html")) {
      return { data: [], error: `[${sheetName}] Web Page ကို Publish လုပ်ထားမိနေပါသည်။ Google Sheets တွင် 'Comma-separated values (.csv)' အဖြစ် ပြန်ရွေးပါ။` };
    }
    
    return { data: parseCSVData(csvText), error: null };
  } catch (error) {
    return { data: [], error: `[${sheetName}] Fetch Error: ${error.message}. အင်တာနက်ချိတ်ဆက်မှု သို့မဟုတ် Link ကို စစ်ဆေးပါ။` };
  }
}

/**
 * CSV စာသားများကို Object Array အဖြစ် ပြောင်းလဲပေးခြင်း (Strict Type Validation ပါဝင်သည်)
 * @param {string} text 
 * @returns {Array<Object>}
 */
function parseCSVData(text) {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];

  // Header များကို အသေးပြောင်း၍ နေရာလွတ်များ ဖယ်ရှားခြင်း
  const headers = lines[0].split(',').map(header => header.trim().toLowerCase());
  
  return lines.slice(1)
    .filter(line => line.replace(/,/g, '').trim() !== '')
    .map(line => {
      // Double quotes များကို ထည့်သွင်းစဉ်းစားကာ ကော်မာများဖြင့် မှန်ကန်စွာ ခွဲထုတ်ခြင်း
      const values = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
      const rowObj = {};
      
      headers.forEach((header, index) => {
        let val = values[index] ? values[index].replace(/^"|"$/g, '').trim() : "";
        
        // Score သို့မဟုတ် ဂဏန်းတန်ဖိုးများအတွက် Data Type ကို တိကျစွာ ခွဲခြားသတ်မှတ်ခြင်း
        const isScoreOrStat = header.includes('score') || header === 'mp' || header === 'w' || header === 'd' || header === 'l' || header === 'pts' || header === 'fpl_pts';
        
        if (isScoreOrStat) {
          // အလွတ်ဖြစ်ပါက Empty string သို့မဟုတ် 0 အဖြစ် မှားယွင်းမသွားစေရန် ထိန်းသိမ်းခြင်း
          rowObj[header] = val === "" ? "" : (isNaN(Number(val)) ? val : Number(val));
        } else {
          rowObj[header] = val;
        }
      });
      
      return rowObj;
    });
}