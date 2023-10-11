// app.mjs
import express from 'express';
import {resolve, dirname} from 'path';
import {readFile, readdir} from 'fs';
import {fileURLToPath} from 'url';
import * as path from 'path';
import {Task} from './task.mjs';

const app = express();
// set hbs engine
app.set('view engine', 'hbs');

// TODO: use middleware to serve static files from public
// make sure to calculate the absolute path to the directory
// with import.meta.url
const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.use(express.static(path.join(__dirname, 'public')));

// Define the views directory
app.set('views', path.join(__dirname, 'views'));

// Middleware to parse URL-encoded request bodies
app.use(express.urlencoded({ extended: true }));

// Custom logging middleware function
app.use((req, res, next) => {
  console.log('Logging Request:');
  console.log(`Method: ${req.method}`);
  console.log(`Path: ${req.originalUrl.split('?')[0]}`);
  console.log(`Query: ${JSON.stringify(req.query)}`);
  console.log(`Body: ${JSON.stringify(req.body)}`);
  next();
});





// TODO: use middleware required for reading body
// Middleware to parse JSON request bodies //NOT SURE
app.use(express.json());

// The global list to store all tasks to be rendered
let taskList = [];

// The reading path
const readingPath = path.resolve(__dirname, './saved-tasks');

// Function to read tasks from files
// Function to read tasks from files using callbacks
function readTasksFromFilesUsingCallbacks(callback) {
  // Read the list of task files in the specified directory
  readdir(readingPath, (err, taskFiles) => {
    if (err) {
      // Handle errors if readdir encounters any
      console.error('Error reading task files:', err);
      // Call the callback with the error and a null result
      callback(err, null);
      return;
    }

    // An array to store the tasks
    const tasks = [];

    // Recursive function to process each file in the taskFiles array
    function processFile(index) {
      if (index >= taskFiles.length) {
        // If all files have been processed, call the callback with the tasks
        callback(null, tasks);
        return;
      }

      // Get the current file and its full path
      const file = taskFiles[index];
      const filePath = path.join(readingPath, file);

      // Read the file content
      readFile(filePath, 'utf-8', (readErr, fileContent) => {
        if (readErr) {
          // Handle errors if readFile encounters any
          console.error(`Error reading file ${file}:`, readErr);
          // Call the callback with the error and a null result
          callback(readErr, null);
          return;
        }
        try {
          // Parse the file content as JSON and create a Task object
          const taskData = JSON.parse(fileContent);
          tasks.push(new Task(taskData));
          // Continue processing the next file
          processFile(index + 1);
        } catch (parseErr) {
          // Handle errors if JSON parsing fails
          console.error(`Error parsing JSON in file ${file}:`, parseErr);
          // Call the callback with the parsing error and a null result
          callback(parseErr, null);
        }
      });
    }

    // Start processing files, beginning with the first file (index 0)
    processFile(0);
  });
}

// Usage:
readTasksFromFilesUsingCallbacks((err, tasks) => {
  if (err) {
    // Handle any error that occurred during file reading or parsing
    console.error('Error reading tasks:', err);
  } else {
    // Use the retrieved tasks (taskList = tasks)
    taskList = pinnedTasks(tasks); //CHECK
    //console.log(taskList);
  }
});


/**
 * This function sort tasks by whether they are pinned or not
 * @param {[Task]} l the array of tasks to be sorted
 * @return {[Task]} sorted array of tasks, with pinned tasks first
 */
function pinnedTasks(l) {
  return [...l].sort((a, b)=>b.pinned-a.pinned);
}

/**
 * This function sort tasks by the give criteria "sort-by" and "sort-order"
 * @param {Request} req query should contain "sort-by" and "sort-order"
 * @param {[Task]} l the array of tasks to be sorted
 * @return {[Task]} sorted array of tasks by the given criteria
 */

// function sortTasks(req, l) {
//   if (req.query['sort-by'] && req.query['sort-order']) {
//     const  newL = [...l];
//     const crit = req.query['sort-by'];
//     const ord = req.query['sort-order'];

//     // Sort tasks by whether they are pinned or not
//     pinnedTasks(newL);

//     newL.sort((a, b) => {
//       if (ord === 'asc') {
//         switch (crit) {
//           case 'due-date': {
//             const a1 = new Date(a[crit]);
//             const b1 = new Date(b[crit]);
//             if (a1 === b1) {
//               return 0;
//             }
//             return a1 > b1 ? 1 : -1;
//           }
//           case 'priority': {
//             return a[crit] - b[crit];
//           }
//           default: {
//             return 0;
//           }
//         }
//       } else if (ord === 'desc') {
//         switch (crit) {
//           case 'due-date': {
//             const a1 = new Date(a[crit]);
//             const b1 = new Date(b[crit]);
//             if (a1 === b1) {
//               return 0;
//             }
//             return a1 < b1 ? 1 : -1;
//           }
//           case 'priority': {
//             return b[crit] - a[crit];
//           }
//           default: {
//             return 0;
//           }
//         }
//       } else {
//         return 0;
//       }
//     });

//     return newL;
//   } else {
//     return l;
//   }
// }






// Define a route for the home page
app.get('/', (req, res) => {

  // Retrieve filter criteria from query parameters
  const titleQuery = req.query.titleQ;
  const tagQuery = req.query.tagQ;

  // Filter tasks based on criteria
  let filteredTasks = taskList;

  if (titleQuery) {
    filteredTasks = filteredTasks.filter(task => task.title.includes(titleQuery));
  }

  if (tagQuery) {
    filteredTasks = filteredTasks.filter(task => task.tags.includes(tagQuery));
  }

  // Sort the filtered tasks (if needed)
  filteredTasks = sortTasks(req, filteredTasks);

  // Render the "home" template with the filtered tasks
  res.render('home', { layout: 'layout', tasks: filteredTasks });
});

app.get('/add', (req, res) => {
  res.render('add'); // Render the "add" template
});

// Add a new route handler for /add
app.post('/add', (req, res) => {
  // Parse the data from the form

  console.log(req); 

  const newTask = {
      title: req.body.title,
      description: req.body.description,
      priority: parseInt(req.body.priority),
      'due-date': req.body['due-date'],
      pinned: req.body.pinned === 'true',
      tags: req.body.tags.split(',').map(tag => tag.trim()), // Split tags by comma
      progress: req.body.progress,
  };

  // Add the new task to the global array
  taskList.unshift(newTask); // Add it to the top

  // Redirect to the home/main page to display the updated list
  res.redirect('/');
});


app.listen(3000);



// function sortTasks(req, l) {
//   if (req.query['sort-by'] && req.query['sort-order']) {
//     const newL = [...l];
//     const crit = req.query['sort-by'];
//     const ord = req.query['sort-order'];

//    // Sort tasks by pinned status first
//    newL = pinnedTasks(newL);

//     newL.sort((a, b)=>{
//       if (ord === 'asc') {
//         switch (crit) {
//           case 'due-date': {
//             const a1 = new Date(a[crit]);
//             const b1 = new Date(b[crit]);
//             if (a1 === b1) { return 0; }
//             return a1 > b1 ? 1 : -1;
//           }
//           case 'priority': {
//             return a[crit] - b[crit];
//           }
//           default: {
//             return 0;
//           }
//         }
//       } else if (ord === 'desc') {
//         switch (crit) {
//           case 'due-date': {
//             const a1 = new Date(a[crit]);
//             const b1 = new Date(b[crit]);
//             if (a1 === b1) { return 0; }
//             return a1 < b1 ? 1 : -1;
//           }
//           case 'priority': {
//             return b[crit] - a[crit];
//           }
//           default: {
//             return 0;
//           }
//         }
//       } else {
//         return [];
//       }
//     });
//     return newL;
//   } else {
//     return l;
//   }
// }




function sortTasks(req, l) {
  if (req.query['sort-by'] && req.query['sort-order']) {
    const newL = [...l];


    const crit = req.query['sort-by'];
    const ord = req.query['sort-order'];
    
    // Sort by pinned status first --> already done when taskList was made 
    //newL.sort((a, b) => b.pinned - a.pinned);
    //const sortedNewL = pinnedTasks(newL); //CHECK IF THIS IS NEEDED
   // console.log(sortedNewL); 

    // Then, apply the requested sorting criteria
    newL.sort((a, b) => {
      if (a.pinned === b.pinned) {
        if (ord === 'asc') {
          switch (crit) {
            case 'due-date': {
              const a1 = new Date(a[crit]);
              const b1 = new Date(b[crit]);
              if (a1 === b1) { return 0; }
              return a1 > b1 ? 1 : -1;
            }
            case 'priority': {
              return a[crit] - b[crit];
            }
            default: {
              return 0;
            }
          }
        } else if (ord === 'desc') {
          switch (crit) {
            case 'due-date': {
              const a1 = new Date(a[crit]);
              const b1 = new Date(b[crit]);
              if (a1 === b1) { return 0; }
              return a1 < b1 ? 1 : -1;
            }
            case 'priority': {
              return b[crit] - a[crit];
            }
            default: {
              return 0;
            }
          }
        }
      } else {
        // Tasks with pinned: true should come before tasks with pinned: false
        return b.pinned - a.pinned;
      }
    });
    return newL;
  } else {
    return l;
  }
}


