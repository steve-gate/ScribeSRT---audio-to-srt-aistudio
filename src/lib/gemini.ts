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
    ĐẶC BIỆT CHÚ Ý (Yêu cầu khắt khe vượt trội về độ chính xác thời gian từng chữ - Word-by-word Ultra Matching):
    - Đảm bảo phụ đề khớp tuyệt đối về mặt thời gian đến từng từ đơn được phát âm (Word-level synchronization).
    - Cắt nhỏ phân đoạn tối đa: Mỗi phân đoạn chỉ được phép chứa từ 1 đến 2 từ (nhiều nhất là 3 từ ngắn). Tuyệt đối không gộp các cụm từ hay câu dài lại. Việc này giúp phụ đề bật tắt nhấp nháy đồng bộ hoàn hảo theo từng nhịp phát âm của giọng nói.
    - Độ chính xác mili-giây tuyệt đối: Thời gian bắt đầu (Start Time) của dòng phụ đề phải trùng khớp với mili-giây đầu tiên từ đó được phát âm. Thời gian kết thúc (End Time) phải bằng mili-giây cuối cùng từ đó dứt âm. Vạch thời gian dạng "HH:MM:SS,mmm --> HH:MM:SS,mmm" phải vô cùng chuẩn xác.
    - Không kéo dài qua khoảng lặng (Instant Termination on Silences): Khi người nói có khoảng dừng, nghỉ lấy hơi, ngắt câu, ngắt quãng hoặc có khoảng lặng > 0.15 giây, mốc kết thúc (End Time) của dòng phụ đề trước đó phải KHÓA NGAY LẬP TỨC tại thời điểm từ đó dừng phát âm. KHÔNG ĐƯỢC kéo dài dòng phụ đề đó lấn qua khoảng lặng.
    - Khử hoàn toàn độ trễ tích lũy (Zero Latency Accumulation / Anti-Drift): Tuyệt đối không để xảy ra hiện tượng lệch mốc thời gian lũy tiến (drift - càng về sau càng bị chậm hay trễ hơn so với tiếng nói thực tế). Phải liên tục đối đối chiếu mốc thời gian tuyệt đối của file âm thanh/video để định vị chính xác.
    `;
  } else {
    promptDetails = `
    - Hãy tạo phụ đề với các câu tự nhiên, dễ đọc (tầm 5 đến 8 từ trên một phân đoạn).
    - Các mốc thời gian bắt đầu và kết thúc khớp nhịp nhàng với câu nói của người nói.
    - Đảm bảo mốc thời gian bắt đầu khớp khi người nói bắt đầu câu và kết thúc ngay khi dứt câu, tránh lệch nhịp.
    `;
  }

  const prompt = `
    Bạn là một hệ thống AI chuyển đổi âm thanh/video thành phụ đề chuyên nghiệp đỉnh cao có độ chính xác tuyệt đối. Nhiệm vụ của bạn là nghe/xem file đính kèm và tạo phụ đề định dạng SRT (.srt) chính xác nhất thế giới.
    
    Yêu cầu chung bắt buộc:
    1. Ngôn ngữ: Tự động nhận diện chuẩn xác ngôn ngữ trong file và viết chuẩn xác 100% bằng ngôn ngữ gốc đó. Không được lược bỏ từ, không tóm tắt, không paraphrase.
    2. Định dạng: SRT chuẩn hoàn toàn (Số thứ tự tăng dần bắt đầu từ 1, dòng thời gian "HH:MM:SS,mmm --> HH:MM:SS,mmm", dòng nội dung văn bản).
    3. Không ảo tưởng hay phỏng đoán thời gian: Bạn phải phân tích dựa trên sóng âm thực tế để tìm mốc thời gian thật.
    ${promptDetails}
    4. Chỉ trả về nội dung file SRT thô, không thêm bất kỳ lời giải thích, ghi chú nào khác, không bọc trong các thẻ định dạng block code Markdown (không dùng \`\`\`srt hay \`\`\`css, trả về trực tiếp nội dung bắt đầu bằng số thứ tự 1).
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
      config: {
        temperature: 0.0, // Chế độ vô cùng chặt chẽ, tối ưu phân tích toán học các mốc thời gian và hạn chế tối đa sự sáng tạo lệch mốc.
      },
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
