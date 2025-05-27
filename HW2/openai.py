import openai
from openai import OpenAI
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Get API key from environment variables
openai.api_key = os.getenv('OPENAI_API_KEY')

# Initialize the client with the API key
client = OpenAI(api_key=os.getenv('OPENAI_API_KEY'))

response = client.responses.create(
    model="gpt-4.1",
    input="""I have a sqlite database with this schema:

            CREATE TABLE bitcoin_blocks (
            block_number INTEGER PRIMARY KEY,
            block_hash TEXT NOT NULL UNIQUE,
            num_transactions INTEGER NOT NULL
            );

            Write a sql statement that gives the total number of blocks."""
)

print(response.output_text)