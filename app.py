import os
import base64
import io
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import google.generativeai as genai
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Configure Gemini API
# Hardcoded API key as requested
api_key = "AIzaSyBsWsm17K1ayJlhmpCCpWuHHdgdP-g7Fjg"

if not api_key:
    # Fallback to .env if hardcoded key is missing (though it's here now)
    api_key = os.getenv("GEMINI_API_KEY")

if not api_key:
    print("Warning: GEMINI_API_KEY not found.")

genai.configure(api_key=api_key)

# Global Session State (for local single-user dev server)
session_state = {
    "chat_session": None,
    "pdf_content": None, # Store the PDF binary data
    "pdf_mime": None
}

def get_chat_session():
    if session_state["chat_session"] is None:
        # Initialize a new chat session with history support
        session_state["chat_session"] = model.start_chat(history=[])
    return session_state["chat_session"]

def reset_session():
    session_state["chat_session"] = None
    session_state["pdf_content"] = None
    session_state["pdf_mime"] = None

# Initialize the model
# As of March 2026, gemini-2.5-flash is the latest model
model = genai.GenerativeModel("gemini-2.5-flash")

@app.route("/")
def index():
    return send_from_directory(".", "index.html")

@app.route("/<path:path>")
def static_proxy(path):
    return send_from_directory(".", path)
@app.route("/api/new-chat", methods=["POST"])
def new_chat():
    reset_session()
    return jsonify({"status": "success", "message": "Session reset"})

@app.route("/api/chat", methods=["POST"])
def chat():
    try:
        data = request.json
        user_message = data.get("message", "")
        image_data = data.get("image") # Base64 string
        pdf_data = data.get("pdf") # Base64 string (Initial upload)
        
        # 1. Handle PDF Upload (If any)
        if pdf_data:
            try:
                # Store PDF in session - resets memory for a new file
                if "," in pdf_data:
                    header, pdf_data = pdf_data.split(",", 1)
                    session_state["pdf_mime"] = header.split(";")[0].split(":")[1]
                else:
                    session_state["pdf_mime"] = "application/pdf"

                session_state["pdf_content"] = base64.b64decode(pdf_data)
                
                # Reset chat session history when a new document is pinned
                session_state["chat_session"] = None 
                
                # If no message provided with PDF, just acknowledge the upload
                if not user_message:
                    return jsonify({
                        "response": "Document pinned successfully! I'm ready to analyze it. What would you like to know?",
                        "status": "success"
                    })
            except Exception as pdf_err:
                print(f"Error processing PDF: {str(pdf_err)}")
                return jsonify({"error": "Failed to process PDF", "status": "error"}), 400

        # 2. Prepare Contents (including session PDF if pinned)
        contents = []
        
        # Add the pinned PDF context if it exists
        if session_state["pdf_content"]:
            pdf_parts = {
                "mime_type": session_state["pdf_mime"],
                "data": session_state["pdf_content"]
            }
            contents.append(pdf_parts)

        # Add image if provided for this specific turning point
        if image_data:
            if "," in image_data:
                _, image_data = image_data.split(",", 1)
            image_bytes = base64.b64decode(image_data)
            contents.append({
                "mime_type": "image/jpeg",
                "data": image_bytes
            })

        # Add user text message
        if user_message:
            contents.append(user_message)

        if not contents:
            return jsonify({"error": "Empty message"}), 400

        # 3. Generate response using the Chat Session
        # NOTE: For Long-Context RAG, we pass the PDF with every message or store it in history.
        # Since we want it remembered for the session, we keep it in the history or contents.
        chat = get_chat_session()
        response = chat.send_message(contents)
        
        return jsonify({
            "response": response.text,
            "status": "success"
        })

    except Exception as e:
        error_str = str(e)
        print(f"Error in /api/chat: {error_str}")
        
        status_code = 500
        if "429" in error_str or "Quota" in error_str or "Rate limit" in error_str:
            status_code = 429
            error_message = "Quota Exceeded: You've hit the Gemini API limit. Please wait a minute before trying again."
        else:
            error_message = error_str
            
        return jsonify({
            "error": error_message,
            "status": "error"
        }), status_code

if __name__ == "__main__":
    app.run(debug=True, port=5000)
