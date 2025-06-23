import json
from datasets import load_dataset
import os

# Define the output file path
output_jsonl_file = "sql_finetune_data.jsonl"

print(f"Loading dataset 'b-mc2/sql-create-context'...")
try:
    # Load the dataset
    ds = load_dataset("b-mc2/sql-create-context")
    train_dataset = ds['train']
    print(f"Dataset loaded. Number of training examples: {len(train_dataset)}")

    # Define the path where the JSONL file will be saved
    script_dir = os.path.dirname(__file__)
    output_path = os.path.join(script_dir, output_jsonl_file)

    print(f"Formatting data and saving to {output_path}...")
    with open(output_path, 'w', encoding='utf-8') as f:
        for i, example in enumerate(train_dataset):
            # The 'sql-coder' model expects the DDL statements as part of the user prompt
            # and then the question, followed by the SQL answer.
            # We'll put the full context in the 'user' role's content.

            # Construct the user's message
            user_message_content = (
                f"Generate a SQL query to answer this question: `{example['question']}`\n\n"
                f"### Database Schema\n"
                f"The query will run on a database with the following schema:\n"
                f"{example['context']}\n"
            )

            # Construct the assistant's message (the expected SQL output)
            assistant_message_content = (
                f"The following SQL query best answers the question `{example['question']}`: ```sql\n"
                f"{example['answer']}```"
            )

            # Create the message structure for a chat model
            formatted_example = {
                "messages": [
                    {"role": "user", "content": user_message_content},
                    {"role": "assistant", "content": assistant_message_content}
                ]
            }

            # Write the JSON object as a line in the JSONL file
            f.write(json.dumps(formatted_example) + '\n')
            if i % 1000 == 0:
                print(f"Processed {i+1} examples...")

    print(f"Data preparation complete! File saved: {output_path}")

except Exception as e:
    print(f"An error occurred during data preparation: {e}")
    print("Please ensure you have an active internet connection to download the dataset.")