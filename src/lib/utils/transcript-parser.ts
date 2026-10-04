export type ParsedTurn = {
    role: "agent" | "customer";
    text: string;
    turn_no: number;
  };
  
  const AGENT_LABELS =
    /^(agent|ai|bot|assistant|system|support|rep|operator)\s*[:\-]\s*/i;
  const CUSTOMER_LABELS =
    /^(customer|user|human|caller|client|visitor|me)\s*[:\-]\s*/i;
  
  export function parseTranscript(raw: string): ParsedTurn[] {
    const lines = raw.trim().split("\n");
    const turns: ParsedTurn[] = [];
    let current: ParsedTurn | null = null;
    let turnNo = 0;
  
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
  
      if (AGENT_LABELS.test(trimmed)) {
        if (current) turns.push(current);
        turnNo++;
        current = {
          role: "agent",
          text: trimmed.replace(AGENT_LABELS, "").trim(),
          turn_no: turnNo,
        };
      } else if (CUSTOMER_LABELS.test(trimmed)) {
        if (current) turns.push(current);
        turnNo++;
        current = {
          role: "customer",
          text: trimmed.replace(CUSTOMER_LABELS, "").trim(),
          turn_no: turnNo,
        };
      } else if (current) {
        current.text += " " + trimmed;
      } else {
        turnNo++;
        current = {
          role: turnNo % 2 === 1 ? "customer" : "agent",
          text: trimmed,
          turn_no: turnNo,
        };
      }
    }
  
    if (current) turns.push(current);
    return turns;
  }
  
  export const SAMPLE_TRANSCRIPT = `Customer: Hi, my internet isn't working since this morning.
  Agent: Hello! I'm sorry to hear that. Let me help you troubleshoot. Can you tell me what lights are showing on your router?
  Customer: There's a red LOS light and the power light is green.
  Agent: I see. A red LOS light indicates a fibre connection issue. This means there's a fault in the fibre line coming to your premises.
  Customer: Oh no. What can be done about it?
  Agent: I'll need to escalate this to our technical team. A technician will be dispatched to check the fibre connection. You should expect a visit within 24 hours.
  Customer: Will I get a refund for the days without internet?
  Agent: I understand your concern. I'm not able to promise refunds directly, but I'll note this on your ticket and our billing team will review your case once the issue is resolved.
  Customer: Okay, that's fair. Can I speak to a human agent?
  Agent: Of course. I'll transfer you to a human representative right away. Is there anything else before I transfer?
  Customer: No, that's all. Thank you.
  Agent: You're welcome. Transferring you now. Have a great day!`;