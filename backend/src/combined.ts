// Free-plan Railway deployment entrypoint: run the HTTP API and BullMQ workers
// in one Node process while keeping Redis in a separate private service.
// The modules own their own startup and graceful-shutdown handlers.
import './index.js';
import './worker/index.js';
