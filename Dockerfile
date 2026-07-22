FROM python:3.12

WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

# Expose the port Hugging Face looks for
EXPOSE 7860

# Run the app
CMD ["python", "app.py"]
