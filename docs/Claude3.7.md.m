Models & pricing
Extended thinking models
Claude 3.7 Sonnet is a hybrid model capable of both standard thinking as well as extended thinking modes. In standard mode, Claude 3.7 Sonnet operates similarly to other models in the Claude 3 family. In extended thinking mode, Claude will output its thinking before outputting its response, allowing you insight into its reasoning process.

​
Claude 3.7 overview
Claude 3.7 Sonnet operates in two modes:

Standard mode: Similar to previous Claude models, providing direct responses without showing internal reasoning
Extended thinking mode: Shows Claude’s reasoning process before delivering the final answer
​
When to use standard mode
Standard mode works well for most general use cases, including:

General content generation
Basic coding assistance
Routine agentic tasks
Computer use guidance
Most conversational applications
​
When to use extended thinking mode
Extended thinking mode excels in these key areas:

Complex analysis: Financial, legal, or data analysis involving multiple parameters and factors
Advanced STEM problems: Mathematics, physics, research & development
Long context handling: Processing and synthesizing information from extensive inputs
Constraint optimization: Problems with multiple competing requirements
Detailed data generation: Creating comprehensive tables or structured information sets
Complex instruction following: Chatbots with intricate system prompts and many factors to consider
Structured creative tasks: Creative writing requiring detailed planning, outlines, or managing multiple narrative elements
To learn more about how extended thinking works, see Extended thinking.

​
Getting started with Claude 3.7 Sonnet
If you are trying Claude 3.7 Sonnet for the first time, here are some tips:

Start with standard mode: Begin by using Claude 3.7 Sonnet without extended thinking to establish a baseline performance
Identify improvement opportunities: Try turning on extended thinking mode at a low budget to see if your use case would benefit from deeper reasoning. It might be the case that your use case would benefit more from more detailed prompting in standard mode rather than extended thinking from Claude.
Gradual implementation: If needed, incrementally increase the thinking budget while testing performance against your requirements.
Optimize token usage: Once you reach acceptable performance, set appropriate token limits to manage costs.
Explore new possibilities: Claude 3.7 Sonnet, with and without extended thinking, is more capable than previous Claude models in a variety of domains. We encourage you to try Claude 3.7 Sonnet for use cases where you previously experienced limitations with other models.
​
Building on Claude 3.7 Sonnet
​
General model information
For pricing, context window size, and other information on Claude 3.7 Sonnet and all other current Claude models, see All models overview.

​
Max tokens and context window changes with Claude 3.7 Sonnet
In older Claude models (prior to Claude 3.7 Sonnet), if the sum of prompt tokens and max_tokens exceeded the model’s context window, the system would automatically adjust max_tokens to fit within the context limit. This meant you could set a large max_tokens value and the system would silently reduce it as needed.

With Claude 3.7 Sonnet, max_tokens (which includes your thinking budget when thinking is enabled) is enforced as a strict limit. The system will now return a validation error if prompt tokens + max_tokens exceeds the context window size.

​
Extended output capabilities (beta)
Claude 3.7 Sonnet can also produce substantially longer responses than previous models with support for up to 128K output tokens (beta)—more than 15x longer than other Claude models. This expanded capability is particularly effective for extended thinking use cases involving complex reasoning, rich code generation, and comprehensive content creation.

This feature can be enabled by passing an anthropic-beta header of output-128k-2025-02-19.


Shell

Python

TypeScript

curl https://api.anthropic.com/v1/messages \
     --header "x-api-key: $ANTHROPIC_API_KEY" \
     --header "anthropic-version: 2023-06-01" \
     --header "anthropic-beta: output-128k-2025-02-19" \
     --header "content-type: application/json" \
     --data \
'{
    "model": "claude-3-7-sonnet-20250219",
    "max_tokens": 128000,
    "thinking": {
        "type": "enabled",
        "budget_tokens": 32000
    },
    "messages": [
        {
            "role": "user",
            "content": "Generate a comprehensive analysis of..."
        }
    ]
}'
When using extended thinking with longer outputs, you can allocate a larger thinking budget to support more thorough reasoning, while still having ample tokens available for the final response.

​
Migrating to Claude 3.7 Sonnet from other models
If you are transferring prompts from another model, whether another Claude model or from another model provider, here are some tips:

​
Standard mode migration
Simplify your prompts: Claude 3.7 Sonnet requires less steering. Remove any model-specific guidance language you’ve used with previous versions, such as language around handling verbosity - such language is likely unnecessary and will save tokens and reduce costs.
Otherwise, generally no prompt changes are needed if you’re using Claude 3.7 Sonnet with extended thinking turned off. If you encounter issues, apply general prompt engineering best practices.

​
Extended thinking mode migration
When using extended thinking, start by removing all chain-of-thought (CoT) guidance from your prompts. Claude 3.7 Sonnet’s thinking capability is designed to work effectively without explicit reasoning instructions.

Instead of prescribing thinking patterns, observe Claude’s natural thinking process first, then adjust your prompts based on what you see.
If you then want to provide thinking guidance, you can include guidance in natural language in your prompt and Claude will be able to generalize such instructions into its own thinking.
For more tips on how to prompt for extended thinking, see Extended thinking tips.
​
Migrating from other model providers
Claude 3.7 Sonnet may respond differently to prompting patterns optimized for other providers’ models. We recommend focusing on clear, direct instructions rather than provider-specific prompting techniques. Removing such instructions tailored for specific model providers may lead to better performance, as Claude is generally good at complex instruction following out of the box.

You can use our optimized prompt improver at console.anthropic.com for assistance with migrating prompts.

​
Next steps
Try the extended thinking cookbook
Explore practical examples of thinking in our cookbook.

Extended thinking documentation
Learn more about how extended thinking works and how to implement it alongside other features such as tool use and prompt caching.

Was this page helpful?


Yes

No
All models overview
Security and compliance
x
linkedin

Build with Claude
Building with extended thinking
Extended thinking gives Claude 3.7 Sonnet enhanced reasoning capabilities for complex tasks, while also providing transparency into its step-by-step thought process before it delivers its final answer.

​
How extended thinking works
When extended thinking is turned on, Claude creates thinking content blocks where it outputs its internal reasoning. Claude incorporates insights from this reasoning before crafting a final response.

The API response will include both thinking and text content blocks.

In multi-turn conversations, only thinking blocks associated with a tool use session or assistant turn in the last message position are visible to Claude and are billed as input tokens; thinking blocks associated with earlier assistant messages are not visible to Claude during sampling and do not get billed as input tokens.

​
Implementing extended thinking
Add the thinking parameter and a specified token budget to use for extended thinking to your API request.

The budget_tokens parameter determines the maximum number of tokens Claude is allowed use for its internal reasoning process. Larger budgets can improve response quality by enabling more thorough analysis for complex problems, although Claude may not use the entire budget allocated, especially at ranges above 32K.

Your budget_tokens must always be less than the max_tokens specified.


Shell

Python

TypeScript

Try in Console


curl https://api.anthropic.com/v1/messages \
     --header "x-api-key: $ANTHROPIC_API_KEY" \
     --header "anthropic-version: 2023-06-01" \
     --header "content-type: application/json" \
     --data \
'{
    "model": "claude-3-7-sonnet-20250219",
    "max_tokens": 20000,
    "thinking": {
        "type": "enabled",
        "budget_tokens": 16000
    },
    "messages": [
        {
            "role": "user",
            "content": "Are there an infinite number of prime numbers such that n mod 4 == 3?"
        }
    ]
}'
The API response will include both thinking and text content blocks:


{
    "content": [
        {
            "type": "thinking",
            "thinking": "To approach this, let's think about what we know about prime numbers...",
            "signature": "zbbJhbGciOiJFU8zI1NiIsImtakcjsu38219c0.eyJoYXNoIjoiYWJjMTIzIiwiaWFxxxjoxNjE0NTM0NTY3fQ...."
        },
        {
            "type": "text",
            "text": "Yes, there are infinitely many prime numbers such that..."
        }
    ]
}
​
Understanding thinking blocks
Thinking blocks represent Claude’s internal thought process. In order to allow Claude to work through problems with minimal internal restrictions while maintaining our safety standards and our stateless APIs, we have implemented the following:

Thinking blocks contain a signature field. This field holds a cryptographic token which verifies that the thinking block was generated by Claude, and is verified when thinking blocks are passed back to the API. When streaming responses, the signature is added via a signature_delta inside a content_block_delta event just before the content_block_stop event. It is only strictly necessary to send back thinking blocks when using tool use with extended thinking. Otherwise you can omit thinking blocks from previous turns, or let the API strip them for you if you pass them back.
Occasionally Claude’s internal reasoning will be flagged by our safety systems. When this occurs, we encrypt some or all of the thinking block and return it to you as a redacted_thinking block. These redacted thinking blocks are decrypted when passed back to the API, allowing Claude to continue its response without losing context.
thinking and redacted_thinking blocks are returned before the text blocks in the response.
Here’s an example showing both normal and redacted thinking blocks:


{
  "content": [
    {
      "type": "thinking",
      "thinking": "Let me analyze this step by step...",
      "signature": "WaUjzkypQ2mUEVM36O2TxuC06KN8xyfbJwyem2dw3URve/op91XWHOEBLLqIOMfFG/UvLEczmEsUjavL...."
    },
    {
      "type": "redacted_thinking",
      "data": "EmwKAhgBEgy3va3pzix/LafPsn4aDFIT2Xlxh0L5L8rLVyIwxtE3rAFBa8cr3qpP..."
    },
    {
      "type": "text",
      "text": "Based on my analysis..."
    }
  ]
}
Seeing redacted thinking blocks in your output is expected behavior. The model can still use this redacted reasoning to inform its responses while maintaining safety guardrails.

If you need to test redacted thinking handling in your application, you can use this special test string as your prompt: ANTHROPIC_MAGIC_STRING_TRIGGER_REDACTED_THINKING_46C9A13E193C177646C7398A98432ECCCE4C1253D5E2D82641AC0E52CC2876CB

When passing thinking and redacted_thinking blocks back to the API in a multi-turn conversation, you must include the complete unmodified block back to the API for the last assistant turn.

This is critical for maintaining the model’s reasoning flow. We suggest always passing back all thinking blocks to the API. For more details, see the Preserving thinking blocks section below.


Example: Working with redacted thinking blocks

​
Suggestions for handling redacted thinking in production
When building customer-facing applications that use extended thinking:

Be aware that redacted thinking blocks contain encrypted content that isn’t human-readable
Consider providing a simple explanation like: “Some of Claude’s internal reasoning has been automatically encrypted for safety reasons. This doesn’t affect the quality of responses.”
If showing thinking blocks to users, you can filter out redacted blocks while preserving normal thinking blocks
Be transparent that using extended thinking features may occasionally result in some reasoning being encrypted
Implement appropriate error handling to gracefully manage redacted thinking without breaking your UI
​
Streaming extended thinking
When streaming is enabled, you’ll receive thinking content via thinking_delta events. Here’s how to handle streaming with thinking:


Shell

Python

TypeScript

Try in Console


curl https://api.anthropic.com/v1/messages \
     --header "x-api-key: $ANTHROPIC_API_KEY" \
     --header "anthropic-version: 2023-06-01" \
     --header "content-type: application/json" \
     --data \
'{
    "model": "claude-3-7-sonnet-20250219",
    "max_tokens": 20000,
    "stream": true,
    "thinking": {
        "type": "enabled",
        "budget_tokens": 16000
    },
    "messages": [
        {
            "role": "user",
            "content": "What is 27 * 453?"
        }
    ]
}'
Example streaming output:


event: message_start
data: {"type": "message_start", "message": {"id": "msg_01...", "type": "message", "role": "assistant", "content": [], "model": "claude-3-7-sonnet-20250219", "stop_reason": null, "stop_sequence": null}}

event: content_block_start
data: {"type": "content_block_start", "index": 0, "content_block": {"type": "thinking", "thinking": ""}}

event: content_block_delta
data: {"type": "content_block_delta", "index": 0, "delta": {"type": "thinking_delta", "thinking": "Let me solve this step by step:\n\n1. First break down 27 * 453"}}

event: content_block_delta
data: {"type": "content_block_delta", "index": 0, "delta": {"type": "thinking_delta", "thinking": "\n2. 453 = 400 + 50 + 3"}}

// Additional thinking deltas...

event: content_block_delta
data: {"type": "content_block_delta", "index": 0, "delta": {"type": "signature_delta", "signature": "EqQBCgIYAhIM1gbcDa9GJwZA2b3hGgxBdjrkzLoky3dl1pkiMOYds..."}}

event: content_block_stop
data: {"type": "content_block_stop", "index": 0}

event: content_block_start
data: {"type": "content_block_start", "index": 1, "content_block": {"type": "text", "text": ""}}

event: content_block_delta
data: {"type": "content_block_delta", "index": 1, "delta": {"type": "text_delta", "text": "27 * 453 = 12,231"}}

// Additional text deltas...

event: content_block_stop
data: {"type": "content_block_stop", "index": 1}

event: message_delta
data: {"type": "message_delta", "delta": {"stop_reason": "end_turn", "stop_sequence": null}}

event: message_stop
data: {"type": "message_stop"}
About streaming behavior with thinking

When using streaming with thinking enabled, you might notice that text sometimes arrives in larger chunks alternating with smaller, token-by-token delivery. This is expected behavior, especially for thinking content.

The streaming system needs to process content in batches for optimal performance, which can result in this “chunky” delivery pattern. We’re continuously working to improve this experience, with future updates focused on making thinking content stream more smoothly.

redacted_thinking blocks will not have any deltas associated and will be sent as a single event.


Example: Streaming with redacted thinking

​
Important considerations when using extended thinking
Working with the thinking budget: The minimum budget is 1,024 tokens. We suggest starting at the minimum and increasing the thinking budget incrementally to find the optimal range for Claude to perform well for your use case. Higher token counts may allow you to achieve more comprehensive and nuanced reasoning, but there may also be diminishing returns depending on the task.

The thinking budget is a target rather than a strict limit - actual token usage may vary based on the task.
Be prepared for potentially longer response times due to the additional processing required for the reasoning process.
Streaming is required when max_tokens is greater than 21,333.
For thinking budgets above 32K: We recommend using batch processing for workloads where the thinking budget is set above 32K to avoid networking issues. Requests pushing the model to think above 32K tokens causes long running requests that might run up against system timeouts and open connection limits.

Thinking compatibility with other features:

Thinking isn’t compatible with temperature, top_p, or top_k modifications as well as forced tool use.
You cannot pre-fill responses when thinking is enabled.
Changes to the thinking budget invalidate cached prompt prefixes that include messages. However, cached system prompts and tool definitions will continue to work when thinking parameters change.
​
Pricing and token usage for extended thinking
Extended thinking tokens count towards the context window and are billed as output tokens. Since thinking tokens are treated as normal output tokens, they also count towards your rate limits. Be sure to account for this increased token usage when planning your API usage.

For Claude 3.7 Sonnet, the pricing is:

Token use	Cost
Input tokens	$3 / MTok
Output tokens (including thinking tokens)	$15 / MTok
Prompt caching write	$3.75 / MTok
Prompt caching read	$0.30 / MTok
Batch processing for extended thinking is available at 50% off these prices and often completes in less than 1 hour.

All extended thinking tokens (including redacted thinking tokens) are billed as output tokens and count toward your rate limits.

In multi-turn conversations, thinking blocks associated with earlier assistant messages do not get billed as input tokens.

When extended thinking is enabled, a specialized 28 or 29 token system prompt is automatically included to support this feature.


Example: Previous thinking tokens omitted as input tokens for future turns

​
Extended output capabilities (beta)
Claude 3.7 Sonnet can produce substantially longer responses than previous models with support for up to 128K output tokens (beta)—more than 15x longer than other Claude models. This expanded capability is particularly effective for extended thinking use cases involving complex reasoning, rich code generation, and comprehensive content creation.

This feature can be enabled by passing an anthropic-beta header of output-128k-2025-02-19.


Shell

Python

TypeScript

curl https://api.anthropic.com/v1/messages \
     --header "x-api-key: $ANTHROPIC_API_KEY" \
     --header "anthropic-version: 2023-06-01" \
     --header "anthropic-beta: output-128k-2025-02-19" \
     --header "content-type: application/json" \
     --data \
'{
    "model": "claude-3-7-sonnet-20250219",
    "max_tokens": 128000,
    "thinking": {
        "type": "enabled",
        "budget_tokens": 32000
    },
    "messages": [
        {
            "role": "user",
            "content": "Generate a comprehensive analysis of..."
        }
    ],
    "stream": true
}'
When using extended thinking with longer outputs, you can allocate a larger thinking budget to support more thorough reasoning, while still having ample tokens available for the final response.

We suggest using streaming or batch mode with this extended output capability; for more details see our guidance on network reliability considerations for long requests.

​
Using extended thinking with prompt caching
Prompt caching with thinking has several important considerations:

Thinking block inclusion in cached prompts

Thinking is only included when generating an assistant turn and not meant to be cached.
Previous turn thinking blocks are ignored.
If thinking becomes disabled, any thinking content passed to the API is simply ignored.
Cache invalidation rules

Alterations to thinking parameters (enabling/disabling or budget changes) invalidate cache breakpoints set in messages.
System prompts and tools maintain caching even when thinking parameters change.
​
Examples of prompt caching with extended thinking

System prompt caching (preserved when thinking changes)


Messages caching (invalidated when thinking changes)

​
Max tokens and context window size with extended thinking
In older Claude models (prior to Claude 3.7 Sonnet), if the sum of prompt tokens and max_tokens exceeded the model’s context window, the system would automatically adjust max_tokens to fit within the context limit. This meant you could set a large max_tokens value and the system would silently reduce it as needed.

With Claude 3.7 Sonnet, max_tokens (which includes your thinking budget when thinking is enabled) is enforced as a strict limit. The system will now return a validation error if prompt tokens + max_tokens exceeds the context window size.

​
How context window is calculated with extended thinking
When calculating context window usage with thinking enabled, there are some considerations to be aware of:

Thinking blocks from previous turns are stripped and not counted towards your context window
Current turn thinking counts towards your max_tokens limit for that turn
The diagram below demonstrates the specialized token management when extended thinking is enabled:

Context window diagram with extended thinking

The effective context window is calculated as:


context window =
  (current input tokens - previous thinking tokens) +
  (thinking tokens + redacted thinking tokens + text output tokens)
We recommend using the token counting API to get accurate token counts for your specific use case, especially when working with multi-turn conversations that include thinking.

You can read through our guide on context windows for a more thorough deep dive.

​
Managing tokens with extended thinking
Given new context window and max_tokens behavior with extended thinking models like Claude 3.7 Sonnet, you may need to:

More actively monitor and manage your token usage
Adjust max_tokens values as your prompt length changes
Potentially use the token counting endpoints more frequently
Be aware that previous thinking blocks don’t accumulate in your context window
This change has been made to provide more predictable and transparent behavior, especially as maximum token limits have increased significantly.

​
Extended thinking with tool use
When using extended thinking with tool use, be aware of the following behavior pattern:

First assistant turn: When you send an initial user message, the assistant response will include thinking blocks followed by tool use requests.

Tool result turn: When you pass the user message with tool result blocks, the subsequent assistant message will not contain any additional thinking blocks.

To expand here, the normal order of a tool use conversation with thinking follows these steps:

User sends initial message
Assistant responds with thinking blocks and tool requests
User sends message with tool results
Assistant responds with either more tool calls or just text (no thinking blocks in this response)
If more tools are requested, repeat steps 3-4 until the conversation is complete
This design allows Claude to show its reasoning process before making tool requests, but not repeat the thinking process after receiving tool results. Claude will not output another thinking block until after the next non-tool_result user turn.

The diagram below illustrates the context window token management when combining extended thinking with tool use:

Context window diagram with extended thinking and tool use


Example: Passing thinking blocks with tool results

​
Preserving thinking blocks
During tool use, you must pass thinking and redacted_thinking blocks back to the API, and you must include the complete unmodified block back to the API. This is critical for maintaining the model’s reasoning flow and conversation integrity.

While you can omit thinking and redacted_thinking blocks from prior assistant role turns, we suggest always passing back all thinking blocks to the API for any multi-turn conversation. The API will:

Automatically filter the provided thinking blocks
Use the relevant thinking blocks necessary to preserve the model’s reasoning
Only bill for the input tokens for the blocks shown to Claude
​
Why thinking blocks must be preserved
When Claude invokes tools, it is pausing its construction of a response to await external information. When tool results are returned, Claude will continue building that existing response. This necessitates preserving thinking blocks during tool use, for a couple of reasons:

Reasoning continuity: The thinking blocks capture Claude’s step-by-step reasoning that led to tool requests. When you post tool results, including the original thinking ensures Claude can continue its reasoning from where it left off.

Context maintenance: While tool results appear as user messages in the API structure, they’re part of a continuous reasoning flow. Preserving thinking blocks maintains this conceptual flow across multiple API calls.

Important: When providing thinking or redacted_thinking blocks, the entire sequence of consecutive thinking or redacted_thinking blocks must match the outputs generated by the model during the original request; you cannot rearrange or modify the sequence of these blocks.

​
Tips for making the best use of extended thinking mode
To get the most out of extended thinking:

Set appropriate budgets: Start with larger thinking budgets (16,000+ tokens) for complex tasks and adjust based on your needs.

Experiment with thinking token budgets: The model might perform differently at different max thinking budget settings. Increasing max thinking budget can make the model think better/harder, at the tradeoff of increased latency. For critical tasks, consider testing different budget settings to find the optimal balance between quality and performance.

You do not need to remove previous thinking blocks yourself: The Anthropic API automatically ignores thinking blocks from previous turns and they are not included when calculating context usage.

Monitor token usage: Keep track of thinking token usage to optimize costs and performance.

Use extended thinking for particularly complex tasks: Enable thinking for tasks that benefit from step-by-step reasoning like math, coding, and analysis.

Account for extended response time: Factor in that generating thinking blocks may increase overall response time.

Handle streaming appropriately: When streaming, be prepared to handle both thinking and text content blocks as they arrive.

Prompt engineering: Review our extended thinking prompting tips if you want to maximize Claude’s thinking capabilities.
Extended thinking tips
This guide provides advanced strategies and techniques for getting the most out of Claude’s extended thinking feature. Extended thinking allows Claude to work through complex problems step-by-step, improving performance on difficult tasks. When you enable extended thinking, Claude shows its reasoning process before providing a final answer, giving you transparency into how it arrived at its conclusion.

See Extended thinking models for guidance on deciding when to use extended thinking vs. standard thinking modes.

​
Before diving in
This guide presumes that you have already decided to use extended thinking mode over standard mode and have reviewed our basic steps on how to get started with extended thinking as well as our extended thinking implementation guide.

​
Technical considerations for extended thinking
Thinking tokens have a minimum budget of 1024 tokens. We recommend that you start with the minimum thinking budget and incrementally increase to adjust based on your needs and task complexity.
For workloads where the optimal thinking budget is above 32K, we recommend that you use batch processing to avoid networking issues. Requests pushing the model to think above 32K tokens causes long running requests that might run up against system timeouts and open connection limits.
Extended thinking performs best in English, though final outputs can be in any language Claude supports.
If you need thinking below the minimum budget, we recommend using standard mode, with thinking turned off, with traditional chain-of-thought prompting with XML tags (like <thinking>). See chain of thought prompting.
​
Prompting techniques for extended thinking
​
Use general instructions first, then troubleshoot with more step-by-step instructions
Claude often performs better with high level instructions to just think deeply about a task rather than step-by-step prescriptive guidance. The model’s creativity in approaching problems may exceed a human’s ability to prescribe the optimal thinking process.

For example, instead of:


User

Think through this math problem step by step: 
1. First, identify the variables
2. Then, set up the equation
3. Next, solve for x
...
Consider:


User

Try in Console


Please think about this math problem thoroughly and in great detail. 
Consider multiple approaches and show your complete reasoning.
Try different methods if your first approach doesn't work.
That said, Claude can still effectively follow complex structured execution steps when needed. The model can handle even longer lists with more complex instructions than previous versions. We recommend that you start with more generalized instructions, then read Claude’s thinking output and iterate to provide more specific instructions to steer its thinking from there.

​
Multishot prompting with extended thinking
Multishot prompting works well with extended thinking. When you provide Claude examples of how to think through problems, it will follow similar reasoning patterns within its extended thinking blocks.

You can include few-shot examples in your prompt in extended thinking scenarios by using XML tags like <thinking> or <scratchpad> to indicate canonical patterns of extended thinking in those examples.

Claude will generalize the pattern to the formal extended thinking process. However, it’s possible you’ll get better results by giving Claude free rein to think in the way it deems best.

Example:


User

Try in Console


I'm going to show you how to solve a math problem, then I want you to solve a similar one.

Problem 1: What is 15% of 80?

<thinking>
To find 15% of 80:
1. Convert 15% to a decimal: 15% = 0.15
2. Multiply: 0.15 × 80 = 12
</thinking>

The answer is 12.

Now solve this one:
Problem 2: What is 35% of 240?
​
Maximizing instruction following with extended thinking
Claude shows significantly improved instruction following when extended thinking is enabled. The model typically:

Reasons about instructions inside the extended thinking block
Executes those instructions in the response
To maximize instruction following:

Be clear and specific about what you want
For complex instructions, consider breaking them into numbered steps that Claude should work through methodically
Allow Claude enough budget to process the instructions fully in its extended thinking
​
Using extended thinking to debug and steer Claude’s behavior
You can use Claude’s thinking output to debug Claude’s logic, although this method is not always perfectly reliable.

To make the best use of this methodology, we recommend the following tips:

We don’t recommend passing Claude’s extended thinking back in the user text block, as this doesn’t improve performance and may actually degrade results.
Prefilling extended thinking is explicitly not allowed, and manually changing the model’s output text that follows its thinking block is likely going to degrade results due to model confusion.
When extended thinking is turned off, standard assistant response text prefill is still allowed.

Sometimes Claude may repeat its extended thinking in the assistant output text. If you want a clean response, instruct Claude not to repeat its extended thinking and to only output the answer.

​
Making the best of long outputs and longform thinking
Claude with extended thinking enabled and extended output capabilities (beta) excels at generating large amounts of bulk data and longform text.

For dataset generation use cases, try prompts such as “Please create an extremely detailed table of…” for generating comprehensive datasets.

For use cases such as detailed content generation where you may want to generate longer extended thinking blocks and more detailed responses, try these tips:

Increase both the maximum extended thinking length AND explicitly ask for longer outputs
For very long outputs (20,000+ words), request a detailed outline with word counts down to the paragraph level. Then ask Claude to index its paragraphs to the outline and maintain the specified word counts
We do not recommend that you push Claude to output more tokens for outputting tokens’ sake. Rather, we encourage you to start with a small thinking budget and increase as needed to find the optimal settings for your use case.

Here are example use cases where Claude excels due to longer extended thinking:


Complex STEM problems


Constraint optimization problems


Thinking frameworks

​
Have Claude reflect on and check its work for improved consistency and error handling
You can use simple natural language prompting to improve consistency and reduce errors:

Ask Claude to verify its work with a simple test before declaring a task complete
Instruct the model to analyze whether its previous step achieved the expected result
For coding tasks, ask Claude to run through test cases in its extended thinking
Example:


User

Try in Console


Write a function to calculate the factorial of a number. 
Before you finish, please verify your solution with test cases for:
- n=0
- n=1
- n=5
- n=10
And fix any issues you find.
​
Next steps
Extended thinking cookbook
Explore practical examples of extended thinking in our cookbook.

Extended thinking guide
See complete technical documentation for implementing extended thinking.

Was this page helpful?


Yes

No
Long context tips
Extended thinking
x
linkedin


Messages
Streaming Messages
When creating a Message, you can set "stream": true to incrementally stream the response using server-sent events (SSE).

​
Streaming with SDKs
Our Python and TypeScript SDKs offer multiple ways of streaming. The Python SDK allows both sync and async streams. See the documentation in each SDK for details.


Python

TypeScript

import anthropic

client = anthropic.Anthropic()

with client.messages.stream(
    max_tokens=1024,
    messages=[{"role": "user", "content": "Hello"}],
    model="claude-3-7-sonnet-20250219",
) as stream:
  for text in stream.text_stream:
      print(text, end="", flush=True)
​
Event types
Each server-sent event includes a named event type and associated JSON data. Each event will use an SSE event name (e.g. event: message_stop), and include the matching event type in its data.

Each stream uses the following event flow:

message_start: contains a Message object with empty content.
A series of content blocks, each of which have a content_block_start, one or more content_block_delta events, and a content_block_stop event. Each content block will have an index that corresponds to its index in the final Message content array.
One or more message_delta events, indicating top-level changes to the final Message object.
A final message_stop event.
​
Ping events
Event streams may also include any number of ping events.

​
Error events
We may occasionally send errors in the event stream. For example, during periods of high usage, you may receive an overloaded_error, which would normally correspond to an HTTP 529 in a non-streaming context:

Example error

event: error
data: {"type": "error", "error": {"type": "overloaded_error", "message": "Overloaded"}}
​
Other events
In accordance with our versioning policy, we may add new event types, and your code should handle unknown event types gracefully.

​
Delta types
Each content_block_delta event contains a delta of a type that updates the content block at a given index.

​
Text delta
A text content block delta looks like:

Text delta

event: content_block_delta
data: {"type": "content_block_delta","index": 0,"delta": {"type": "text_delta", "text": "ello frien"}}
​
Input JSON delta
The deltas for tool_use content blocks correspond to updates for the input field of the block. To support maximum granularity, the deltas are partial JSON strings, whereas the final tool_use.input is always an object.

You can accumulate the string deltas and parse the JSON once you receive a content_block_stop event, by using a library like Pydantic to do partial JSON parsing, or by using our SDKs, which provide helpers to access parsed incremental values.

A tool_use content block delta looks like:

Input JSON delta

event: content_block_delta
data: {"type": "content_block_delta","index": 1,"delta": {"type": "input_json_delta","partial_json": "{\"location\": \"San Fra"}}}
Note: Our current models only support emitting one complete key and value property from input at a time. As such, when using tools, there may be delays between streaming events while the model is working. Once an input key and value are accumulated, we emit them as multiple content_block_delta events with chunked partial json so that the format can automatically support finer granularity in future models.

​
Thinking delta
When using extended thinking with streaming enabled, you’ll receive thinking content via thinking_delta events. These deltas correspond to the thinking field of the thinking content blocks.

For thinking content, a special signature_delta event is sent just before the content_block_stop event. This signature is used to verify the integrity of the thinking block.

A typical thinking delta looks like:

Thinking delta

event: content_block_delta
data: {"type": "content_block_delta", "index": 0, "delta": {"type": "thinking_delta", "thinking": "Let me solve this step by step:\n\n1. First break down 27 * 453"}}
The signature delta looks like:

Signature delta

event: content_block_delta
data: {"type": "content_block_delta", "index": 0, "delta": {"type": "signature_delta", "signature": "EqQBCgIYAhIM1gbcDa9GJwZA2b3hGgxBdjrkzLoky3dl1pkiMOYds..."}}
​
Raw HTTP Stream response
We strongly recommend that use our client SDKs when using streaming mode. However, if you are building a direct API integration, you will need to handle these events yourself.

A stream response is comprised of:

A message_start event
Potentially multiple content blocks, each of which contains: a. A content_block_start event b. Potentially multiple content_block_delta events c. A content_block_stop event
A message_delta event
A message_stop event
There may be ping events dispersed throughout the response as well. See Event types for more details on the format.

​
Basic streaming request
Request

curl https://api.anthropic.com/v1/messages \
     --header "anthropic-version: 2023-06-01" \
     --header "content-type: application/json" \
     --header "x-api-key: $ANTHROPIC_API_KEY" \
     --data \
'{
  "model": "claude-3-7-sonnet-20250219",
  "messages": [{"role": "user", "content": "Hello"}],
  "max_tokens": 256,
  "stream": true
}'
Response

event: message_start
data: {"type": "message_start", "message": {"id": "msg_1nZdL29xx5MUA1yADyHTEsnR8uuvGzszyY", "type": "message", "role": "assistant", "content": [], "model": "claude-3-7-sonnet-20250219", "stop_reason": null, "stop_sequence": null, "usage": {"input_tokens": 25, "output_tokens": 1}}}

event: content_block_start
data: {"type": "content_block_start", "index": 0, "content_block": {"type": "text", "text": ""}}

event: ping
data: {"type": "ping"}

event: content_block_delta
data: {"type": "content_block_delta", "index": 0, "delta": {"type": "text_delta", "text": "Hello"}}

event: content_block_delta
data: {"type": "content_block_delta", "index": 0, "delta": {"type": "text_delta", "text": "!"}}

event: content_block_stop
data: {"type": "content_block_stop", "index": 0}

event: message_delta
data: {"type": "message_delta", "delta": {"stop_reason": "end_turn", "stop_sequence":null}, "usage": {"output_tokens": 15}}

event: message_stop
data: {"type": "message_stop"}

​
Streaming request with tool use
In this request, we ask Claude to use a tool to tell us the weather.

Request

  curl https://api.anthropic.com/v1/messages \
    -H "content-type: application/json" \
    -H "x-api-key: $ANTHROPIC_API_KEY" \
    -H "anthropic-version: 2023-06-01" \
    -d '{
      "model": "claude-3-7-sonnet-20250219",
      "max_tokens": 1024,
      "tools": [
        {
          "name": "get_weather",
          "description": "Get the current weather in a given location",
          "input_schema": {
            "type": "object",
            "properties": {
              "location": {
                "type": "string",
                "description": "The city and state, e.g. San Francisco, CA"
              }
            },
            "required": ["location"]
          }
        }
      ],
      "tool_choice": {"type": "any"},
      "messages": [
        {
          "role": "user",
          "content": "What is the weather like in San Francisco?"
        }
      ],
      "stream": true
    }'
Response

event: message_start
data: {"type":"message_start","message":{"id":"msg_014p7gG3wDgGV9EUtLvnow3U","type":"message","role":"assistant","model":"claude-3-haiku-20240307","stop_sequence":null,"usage":{"input_tokens":472,"output_tokens":2},"content":[],"stop_reason":null}}

event: content_block_start
data: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}

event: ping
data: {"type": "ping"}

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Okay"}}

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":","}}

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":" let"}}

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"'s"}}

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":" check"}}

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":" the"}}

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":" weather"}}

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":" for"}}

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":" San"}}

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":" Francisco"}}

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":","}}

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":" CA"}}

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":":"}}

event: content_block_stop
data: {"type":"content_block_stop","index":0}

event: content_block_start
data: {"type":"content_block_start","index":1,"content_block":{"type":"tool_use","id":"toolu_01T1x1fJ34qAmk2tNTrN7Up6","name":"get_weather","input":{}}}

event: content_block_delta
data: {"type":"content_block_delta","index":1,"delta":{"type":"input_json_delta","partial_json":""}}

event: content_block_delta
data: {"type":"content_block_delta","index":1,"delta":{"type":"input_json_delta","partial_json":"{\"location\":"}}

event: content_block_delta
data: {"type":"content_block_delta","index":1,"delta":{"type":"input_json_delta","partial_json":" \"San"}}

event: content_block_delta
data: {"type":"content_block_delta","index":1,"delta":{"type":"input_json_delta","partial_json":" Francisc"}}

event: content_block_delta
data: {"type":"content_block_delta","index":1,"delta":{"type":"input_json_delta","partial_json":"o,"}}

event: content_block_delta
data: {"type":"content_block_delta","index":1,"delta":{"type":"input_json_delta","partial_json":" CA\""}}

event: content_block_delta
data: {"type":"content_block_delta","index":1,"delta":{"type":"input_json_delta","partial_json":", "}}

event: content_block_delta
data: {"type":"content_block_delta","index":1,"delta":{"type":"input_json_delta","partial_json":"\"unit\": \"fah"}}

event: content_block_delta
data: {"type":"content_block_delta","index":1,"delta":{"type":"input_json_delta","partial_json":"renheit\"}"}}

event: content_block_stop
data: {"type":"content_block_stop","index":1}

event: message_delta
data: {"type":"message_delta","delta":{"stop_reason":"tool_use","stop_sequence":null},"usage":{"output_tokens":89}}

event: message_stop
data: {"type":"message_stop"}
​
Streaming request with extended thinking
In this request, we enable extended thinking with streaming to see Claude’s step-by-step reasoning.

Request

curl https://api.anthropic.com/v1/messages \
     --header "x-api-key: $ANTHROPIC_API_KEY" \
     --header "anthropic-version: 2023-06-01" \
     --header "content-type: application/json" \
     --data \
'{
    "model": "claude-3-7-sonnet-20250219",
    "max_tokens": 20000,
    "stream": true,
    "thinking": {
        "type": "enabled",
        "budget_tokens": 16000
    },
    "messages": [
        {
            "role": "user",
            "content": "What is 27 * 453?"
        }
    ]
}'
Response

event: message_start
data: {"type": "message_start", "message": {"id": "msg_01...", "type": "message", "role": "assistant", "content": [], "model": "claude-3-7-sonnet-20250219", "stop_reason": null, "stop_sequence": null}}

event: content_block_start
data: {"type": "content_block_start", "index": 0, "content_block": {"type": "thinking", "thinking": ""}}

event: content_block_delta
data: {"type": "content_block_delta", "index": 0, "delta": {"type": "thinking_delta", "thinking": "Let me solve this step by step:\n\n1. First break down 27 * 453"}}

event: content_block_delta
data: {"type": "content_block_delta", "index": 0, "delta": {"type": "thinking_delta", "thinking": "\n2. 453 = 400 + 50 + 3"}}

event: content_block_delta
data: {"type": "content_block_delta", "index": 0, "delta": {"type": "thinking_delta", "thinking": "\n3. 27 * 400 = 10,800"}}

event: content_block_delta
data: {"type": "content_block_delta", "index": 0, "delta": {"type": "thinking_delta", "thinking": "\n4. 27 * 50 = 1,350"}}

event: content_block_delta
data: {"type": "content_block_delta", "index": 0, "delta": {"type": "thinking_delta", "thinking": "\n5. 27 * 3 = 81"}}

event: content_block_delta
data: {"type": "content_block_delta", "index": 0, "delta": {"type": "thinking_delta", "thinking": "\n6. 10,800 + 1,350 + 81 = 12,231"}}

event: content_block_delta
data: {"type": "content_block_delta", "index": 0, "delta": {"type": "signature_delta", "signature": "EqQBCgIYAhIM1gbcDa9GJwZA2b3hGgxBdjrkzLoky3dl1pkiMOYds..."}}

event: content_block_stop
data: {"type": "content_block_stop", "index": 0}

event: content_block_start
data: {"type": "content_block_start", "index": 1, "content_block": {"type": "text", "text": ""}}

event: content_block_delta
data: {"type": "content_block_delta", "index": 1, "delta": {"type": "text_delta", "text": "27 * 453 = 12,231"}}

event: content_block_stop
data: {"type": "content_block_stop", "index": 1}

event: message_delta
data: {"type": "message_delta", "delta": {"stop_reason": "end_turn", "stop_sequence": null}}

event: message_stop
data: {"type": "message_stop"}