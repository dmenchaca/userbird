import { FeedbackService } from '../core/feedback-service';

export type { FeedbackSubmission } from '../core/types';

const feedbackService = FeedbackService.getInstance();

export const submitFeedback = feedbackService.submitFeedback.bind(feedbackService);
