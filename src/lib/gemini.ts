import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function transcribeToSRT(file: File, precision: "standard" | "ultra" = "ultra"): Promise<string> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  // Convert file to base64
  const base64Data = await fileToBase64(file);
  
  let promptDetails = "";
  if (precision === "ultra") {
    promptDetails = `
    ĐẶC BIỆT CHÚ Ý (Yêu cầu khắt khe về độ chính xác thời gian):
    - Hãy tạo phụ đề với độ khớp thời gian cực kỳ cao đến từng từ được nói (Word-level timestamps). Sau đây là cách triển khai:
    - Hãy chia các phân đoạn phụ đề thành các cụm siêu ngắn (mỗi dòng chỉ nên chứa từ 1 đến 3 từ, tối đa là 4 từ). Việc này giúp phụ đề xuất hiện đồng bộ tuyệt đối với nhịp điệu phát âm từ của người nói.
    - Thời gian bắt đầu (Start Time) và kết thúc (End Time) của từng dòng phụ đề phải căn chỉnh chuẩn xác đến mức mili-giây (ví dụ: 00:00:01,120 --> 00:00:02,040), phản ánh đúng thời điểm phát âm của các từ hiển thị trong dòng đó.
    - Đảm bảo không có khoảng trống bị bỏ sót và không gộp nguyên một câu dài vào một mốc thời gian dài. Phải bẻ nhỏ câu ra tối đa để phụ đề nhấp nháy khớp hoàn hảo từng nhịp nói.
    `;
  } else {
    promptDetails = `
    - Hãy tạo phụ đề với các câu tự nhiên, dễ đọc (tầm 5 đến 8 từ trên một phân đoạn).
    - Các mốc thời gian bắt đầu và kết thúc khớp nhịp nhàng với câu nói của người nói.
    `;
  }

  const prompt = `
    Bạn là một chuyên gia tạo phụ đề chuyên nghiệp cấp cao. Hãy nghe/xem file đính kèm và tạo phụ đề định dạng SRT (.srt) chất lượng cao nhất.
    
    Yêu cầu chung:
    1. Ngôn ngữ: Tự động nhận diện ngôn ngữ trong file và dịch/viết phụ đề chính xác bằng ngôn ngữ gốc đó.
    2. Định dạng: SRT chuẩn hoàn toàn (Số thứ tự phân đoạn tăng dần bắt đầu từ 1, dòng thời gian dạng "HH:MM:SS,mmm --> HH:MM:SS,mmm", dòng nội dung văn bản).
    3. Tránh tuyệt đối việc gộp nhiều câu dài vào một mốc thời gian không khớp.
    ${promptDetails}
    4. Chỉ trả về nội dung file SRT thô, không thêm bất kỳ lời giải thích, ghi chú hay thẻ định dạng Markdown nào khác (không bọc trong tag \`\`\`srt hay \`\`\`css, trả về trực tiếp nội dung bắt đầu bằng sđt 1).
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
