FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application
COPY . .

# Expose port 7860 as required by Hugging Face
EXPOSE 7860

# Run the app
CMD ["python", "app.py"]
