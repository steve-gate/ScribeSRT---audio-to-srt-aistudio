import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

interface SubtitleSegment {
  startTime: string;
  endTime: string;
  text: string;
}

export async function transcribeToSRT(file: File, duration?: number): Promise<string> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  // Convert duration to SRT timestamp format for the prompt
  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
  };

  const durationStr = duration ? formatTime(duration) : "không xác định";

  // Convert file to base64
  const base64Data = await fileToBase64(file);
  
  const prompt = `
    Nghe file âm thanh/video đính kèm và trích xuất phụ đề với độ chính xác thời gian tuyệt đối.
    Tổng thời lượng của file là: ${durationStr}. TUYỆT ĐỐI KHÔNG tạo ra mốc thời gian vượt quá con số này.
    
    YÊU CẦU ĐỒNG BỘ:
    1. Khớp thời gian thực tế: Mốc thời gian phải được đo dựa trên trục thời gian thực tế của âm thanh, không đoán dựa trên số lượng từ. 
    2. Nếu có đoạn dừng (pause) hoặc im lặng, bạn phải kết thúc câu cũ và bắt đầu câu mới với mốc thời gian tương ứng. Không gộp khoảng thời gian im lặng vào phụ đề.
    3. Tránh lỗi trễ (lag): Hãy chắc chắn rằng 'startTime' là lúc âm tiết đầu tiên vang lên. 'endTime' là lúc âm tiết cuối cùng kết thúc.
    4. Nhận diện tự động ngôn ngữ và giữ nguyên ngôn ngữ gốc.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash", 
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: file.type,
                data: base64Data,
              },
            },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              startTime: {
                type: Type.STRING,
                description: `Thời gian bắt đầu, ĐÚNG định dạng HH:MM:SS,mmm (ví dụ: 00:00:01,500). KHÔNG vượt quá ${durationStr}`,
              },
              endTime: {
                type: Type.STRING,
                description: `Thời gian kết thúc, ĐÚNG định dạng HH:MM:SS,mmm (ví dụ: 00:00:03,200). KHÔNG vượt quá ${durationStr}`,
              },
              text: {
                type: Type.STRING,
                description: "Nội dung câu nói (văn bản thuần túy)",
              },
            },
            required: ["startTime", "endTime", "text"],
          },
        },
      },
    });

    const jsonStr = response.text || "[]";
    let segments: SubtitleSegment[] = [];
    try {
      segments = JSON.parse(jsonStr);
    } catch (e) {
      console.error("Failed to parse JSON response:", e);
      throw new Error("Mô hình trả về dữ liệu không hợp lệ.");
    }

    // Convert JSON explicitly to SRT format
    let srtResult = "";
    segments.forEach((seg, index) => {
      // Basic cleanup in case model forgets commas
      const start = seg.startTime.replace(".", ",");
      const end = seg.endTime.replace(".", ",");
      srtResult += `${index + 1}\n${start} --> ${end}\n${seg.text}\n\n`;
    });

    return srtResult.trim();
  } catch (error) {
    console.error("Gemini Transcription Error:", error);
    throw error;
  }
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const base64String = reader.result as string;
      resolve(base64String.split(",")[1]);
    };
    reader.onerror = (error) => reject(error);
  });
} 

