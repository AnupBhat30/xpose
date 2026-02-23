import multiprocessing
import os

bind = f"0.0.0.0:{os.getenv('PORT', '8000')}"
workers = max(2, multiprocessing.cpu_count() * 2)
worker_class = "uvicorn.workers.UvicornWorker"
keepalive = 5
timeout = 60
accesslog = "-"
errorlog = "-"
