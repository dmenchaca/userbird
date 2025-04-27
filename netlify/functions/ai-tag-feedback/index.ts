import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { Configuration, OpenAIApi } from 'openai';

// Initialize Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Initialize OpenAI
if (!process.env.OPENAI_API_KEY) {
  console.error('OPENAI_API_KEY environment variable is required');
}

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

// Minimum confidence threshold for tagging
const CONFIDENCE_THRESHOLD = 0.85;

export const handler: Handler = async (event) => {
  try {
    // Only accept POST requests
    if (event.httpMethod !== 'POST') {
      return {
        statusCode: 405,
        body: JSON.stringify({ error: 'Method not allowed' })
      };
    }
    
    // Parse the request body
    const body = JSON.parse(event.body || '{}');
    const { feedbackId, formId, content } = body;
    
    if (!feedbackId || !formId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required fields: feedbackId, formId' })
      };
    }
    
    console.log(`Processing feedback ${feedbackId} for form ${formId}`);
    
    // Fetch the form rules and available tags
    const [formData, tagsData] = await Promise.all([
      supabase.from('forms').select('rules').eq('id', formId).single(),
      supabase.from('feedback_tags').select('*').eq('form_id', formId)
    ]);
    
    // Check if we have the necessary data to proceed
    if (formData.error) {
      console.error('Error fetching form data:', formData.error);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Error fetching form data' })
      };
    }
    
    const rules = formData.data?.rules;
    const tags = tagsData.data || [];
    
    // Skip only if no tags are available
    if (tags.length === 0) {
      console.log(`Skipping AI tagging: No tags available for form ${formId}`);
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'Skipped tagging: No tags available' })
      };
    }
    
    // If rules are missing, log but continue with default approach
    if (!rules) {
      console.log(`No rules defined for form ${formId}, using default tagging approach`);
    }
    
    // Get the feedback message if not provided
    let feedbackMessage = content;
    if (!feedbackMessage) {
      const { data: feedback, error: feedbackError } = await supabase
        .from('feedback')
        .select('message')
        .eq('id', feedbackId)
        .single();
      
      if (feedbackError || !feedback) {
        console.error('Error fetching feedback:', feedbackError);
        return {
          statusCode: 500,
          body: JSON.stringify({ error: 'Error fetching feedback content' })
        };
      }
      
      feedbackMessage = feedback.message;
    }
    
    // If we still don't have feedback content, return
    if (!feedbackMessage || feedbackMessage.trim() === '') {
      console.log(`Skipping AI tagging: Empty feedback message for feedback ${feedbackId}`);
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'Skipped tagging: Empty feedback message' })
      };
    }
    
    // Log available tags for debugging
    console.log(`Available tags for form ${formId}:`, tags.map(tag => `${tag.name} (${tag.id})`).join(', '));
    
    // Prepare the tag options for the AI
    const tagOptions = tags.map(tag => ({
      id: tag.id,
      name: tag.name,
      color: tag.color
    }));
    
    // Create a clearer system prompt with explicit instructions about using IDs
    const systemPrompt = `You are a precise feedback tagging assistant. 
Your task is to analyze feedback and assign the most appropriate tag from a list.

IMPORTANT FORMATTING RULES:
1. Always use the exact tag ID (UUID) in your response, NEVER use the tag name.
2. For example, use "3591240d-4ab8-4226-8681-9a95fe77fe5c", NOT "Enhancement".
3. Return valid JSON with all required fields.
4. Always specify the confidence as a number between 0 and 1.`;

    // Create the prompt for the AI with example response format
    const prompt = `
You are an AI assistant helping to tag feedback for a SaaS product.

FEEDBACK TAGGING RULES:
${rules || `Please analyze the feedback and match it to the most appropriate tag based on:
1. The content and sentiment of the feedback
2. Common patterns in software feedback (bugs, feature requests, usability issues, etc.)
3. The name and purpose of the available tags
4. The context within which the feedback was provided

When matching:
- "Bug" tags should be used for issues, errors, or unexpected behavior
- "Feature" tags for new functionality requests
- "UI/UX" tags for design and usability feedback
- "Performance" tags for speed and optimization concerns
- "Documentation" tags for help or guidance requests
- When unsure, select the tag that best captures the main intent of the feedback`}

AVAILABLE TAGS:
${JSON.stringify(tagOptions, null, 2)}

USER FEEDBACK:
"""
${feedbackMessage}
"""

Based on the rules and the feedback above, which tag is the most appropriate? 
You must ONLY select from the available tags provided.
If none of the tags match well with the feedback, say "NO_TAG".

EXAMPLE RESPONSE FORMAT:
{
  "selectedTagId": "3591240d-4ab8-4226-8681-9a95fe77fe5c",  // MUST be the exact ID from the list above, not the name
  "confidence": 0.95,
  "reasoning": "This feedback suggests an enhancement to existing functionality.",
  "alternativeTags": [
    {
      "tagId": "b68b6d6e-d067-4371-a279-862e1c4b0663",  // MUST be the exact ID from the list above, not the name
      "confidence": 0.7,
      "reason": "Could also be considered a new feature."
    }
  ]
}

Your response (use exact tag IDs from the list above, not tag names):`;

    console.log('Sending request to OpenAI for tag analysis');
    
    // Call OpenAI for analysis with the enhanced prompts
    const response = await openai.createChatCompletion({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt }
      ],
      temperature: 0.3, // Low temperature for more deterministic results
      max_tokens: 800
    });
    
    const aiResponse = response.data.choices[0]?.message?.content;
    if (!aiResponse) {
      console.error('Empty response from OpenAI');
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Empty response from AI' })
      };
    }
    
    // Parse the AI response to get tag recommendation
    let parsedResponse;
    try {
      // Find JSON in the response (sometimes the AI includes additional text)
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      const jsonString = jsonMatch ? jsonMatch[0] : aiResponse;
      parsedResponse = JSON.parse(jsonString);
    } catch (err) {
      console.error('Error parsing AI response:', err, 'Raw response:', aiResponse);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Invalid AI response format' })
      };
    }
    
    const { selectedTagId, confidence, reasoning, alternativeTags = [] } = parsedResponse;
    
    // Get tag name for more readable logs
    const selectedTagName = selectedTagId !== 'NO_TAG' 
      ? tags.find(t => t.id === selectedTagId)?.name || 'Unknown tag' 
      : 'NO_TAG';
    
    // Enhanced logging with more details
    console.log('AI tagging analysis:');
    console.log(`- Selected: ${selectedTagName} (${selectedTagId})`);
    console.log(`- Confidence: ${confidence} (threshold: ${CONFIDENCE_THRESHOLD})`);
    console.log(`- Reasoning: ${reasoning}`);
    
    // Log alternatives if present
    if (alternativeTags && alternativeTags.length > 0) {
      console.log('- Alternative tags considered:');
      alternativeTags.forEach((alt, index) => {
        const altTagName = tags.find(t => t.id === alt.tagId)?.name || 'Unknown';
        console.log(`  ${index+1}. ${altTagName} (${alt.tagId}) - Confidence: ${alt.confidence}, Reason: ${alt.reason}`);
      });
    }
    
    // Ensure confidence is a number for correct comparison
    const confidenceValue = typeof confidence === 'string' 
      ? parseFloat(confidence) 
      : Number(confidence);
    
    // Check if the tag is valid and meets the confidence threshold
    const isValidTag = selectedTagId && 
                      selectedTagId !== 'NO_TAG' && 
                      tags.some(tag => tag.id === selectedTagId);
                      
    const meetsThreshold = !isNaN(confidenceValue) && confidenceValue >= CONFIDENCE_THRESHOLD;
    
    // Log the decision factors
    console.log(`Decision factors: Valid tag: ${isValidTag}, Meets threshold: ${meetsThreshold}, Confidence value: ${confidenceValue}`);
    
    // Only apply tag if all conditions are met
    if (isValidTag && meetsThreshold) {
      // Get current tag if any
      const { data: currentFeedback } = await supabase
        .from('feedback')
        .select('tag_id')
        .eq('id', feedbackId)
        .single();
      
      const oldTagId = currentFeedback?.tag_id || null;
      const oldTagName = oldTagId 
        ? tags.find(t => t.id === oldTagId)?.name || 'Unknown tag'
        : null;
      
      console.log(`Applying tag: ${selectedTagName} (replacing ${oldTagName || 'no tag'})`);
      
      // Update the feedback with the selected tag
      const { error: updateError } = await supabase
        .from('feedback')
        .update({ tag_id: selectedTagId })
        .eq('id', feedbackId);
      
      if (updateError) {
        console.error('Error updating feedback with tag:', updateError);
        return {
          statusCode: 500,
          body: JSON.stringify({ error: 'Error applying tag to feedback' })
        };
      }
      
      // Create a feedback_replies entry for the tag change
      const { error: replyError } = await supabase
        .from('feedback_replies')
        .insert([{
          feedback_id: feedbackId,
          type: 'tag_change',
          sender_type: 'ai',
          meta: {
            action: oldTagId ? 'changed' : 'added',
            source: 'ai',
            tag_id: selectedTagId,
            old_tag_id: oldTagId,
            confidence: confidenceValue,
            reasoning: reasoning,
            alternatives: alternativeTags
          }
        }]);
      
      if (replyError) {
        console.error('Error creating tag change record:', replyError);
        // Don't fail the whole operation if just the record creation fails
      } else {
        console.log('Successfully created tag change activity record');
      }
      
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          message: 'Successfully tagged feedback',
          tagId: selectedTagId,
          tagName: selectedTagName,
          confidence: confidenceValue
        })
      };
    } else {
      // Provide more specific reason for skipping
      let skipReason = "Unknown reason";
      if (!isValidTag) {
        skipReason = selectedTagId === 'NO_TAG' 
          ? "AI determined no tag is appropriate" 
          : "Selected tag ID is not valid";
      } else if (!meetsThreshold) {
        skipReason = `Confidence (${confidenceValue}) below threshold (${CONFIDENCE_THRESHOLD})`;
      }
      
      console.log(`Skipping tagging: ${skipReason}`);
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          message: `No tag applied - ${skipReason}`,
          suggestedTagId: selectedTagId,
          suggestedTagName: selectedTagName,
          confidence: confidenceValue || 0
        })
      };
    }
  } catch (error) {
    console.error('Error in AI tagging:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error in AI tagging' })
    };
  }
}; 