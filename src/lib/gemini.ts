import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function transcribeToSRT(file: File): Promise<string> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  // Convert file to base64
  const base64Data = await fileToBase64(file);
  
  const prompt = `
    Bạn là một chuyên gia tạo phụ đề. Hãy nghe/xem file đính kèm và tạo phụ đề định dạng SRT (.srt).
    Yêu cầu:
    1. Ngôn ngữ: Tự động nhận diện ngôn ngữ trong file và tạo phụ đề bằng ngôn ngữ đó.
    2. Định dạng: SRT chuẩn (Số thứ tự, Thời gian bắt đầu --> Thời gian kết thúc, Nội dung).
    3. Độ chính xác: Đảm bảo khớp thời gian (timestamps) chính xác nhất có thể.
    4. Chỉ trả về nội dung file SRT, không thêm bất kỳ lời giải thích nào khác.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
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
    });

    return response.text || "";
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
      // Remove the data:mime/type;base64, prefix
      resolve(base64String.split(",")[1]);
    };
    reader.onerror = (error) => reject(error);
  });
}
