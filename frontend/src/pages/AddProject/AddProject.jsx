import React, { useState, useRef, useEffect } from 'react';
import './AddProject.css';
import TopBar from '../../components/TopBar/TopBar';
import { useNavigate } from 'react-router-dom';
import { jwtDecode } from "jwt-decode"; // Import jwtDecode
import API_BASE_URL from '../../src';


// Sample data for random generation
const sampleData = {
  projectName: "School Timetable Project",
  classes: [
    { room: "101", capacity: "40", building: "Main Building" },
    { room: "102", capacity: "35", building: "Main Building" },
    { room: "S101", capacity: "30", building: "Science Wing" },
    { room: "A101", capacity: "40", building: "Arts Block" }
  ],
  faculty: [
    { id: "F001", name: "John Smith", mail: "john.smith@school.edu" },
    { id: "F002", name: "Sarah Johnson", mail: "sarah.johnson@school.edu" },
    { id: "F003", name: "Robert Davis", mail: "robert.davis@school.edu" },
    { id: "F004", name: "Emily Wilson", mail: "emily.wilson@school.edu" }
  ],
  grades: [
    { grade: "9", section: "A", strength: "35", classAssignmentType: "same" },
    { grade: "9", section: "B", strength: "32", classAssignmentType: "same" },
    { grade: "10", section: "A", strength: "38", classAssignmentType: "same" },
    { grade: "10", section: "B", strength: "36", classAssignmentType: "any" }
  ],
  buildings: ["Main Building", "Science Wing", "Arts Block"],
  subjects: [
    {
      code: "MATH101",
      subject: "Mathematics",
      facultyIds: ["F001"],
      gradeSections: [{ grade: "9", section: "A" }, { grade: "9", section: "B" }],
      classesWeek: "5",
      isCombined: false,
      assignedClasses: []
    },
    {
      code: "ENG101",
      subject: "English",
      facultyIds: ["F002"],
      gradeSections: [{ grade: "9", section: "A" }, { grade: "9", section: "B" }],
      classesWeek: "4",
      isCombined: false,
      assignedClasses: []
    },
    {
      code: "SCI101",
      subject: "Science",
      facultyIds: ["F003"],
      gradeSections: [{ grade: "9", section: "A" }, { grade: "9", section: "B" }],
      classesWeek: "4",
      isCombined: false,
      assignedClasses: []
    }
  ],
  timeSlots: [
    { day: "Monday", startTime: "08:30", endTime: "09:30", applicableTo: ["9 - A", "9 - B", "10 - A", "10 - B"] },
    { day: "Monday", startTime: "09:30", endTime: "10:30", applicableTo: ["9 - A", "9 - B", "10 - A", "10 - B"] },
    { day: "Monday", startTime: "10:45", endTime: "11:45", applicableTo: ["9 - A", "9 - B", "10 - A", "10 - B"] },
    { day: "Tuesday", startTime: "08:30", endTime: "09:30", applicableTo: ["9 - A", "9 - B", "10 - A", "10 - B"] }
  ]
};

const MultiStepForm = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [showUpload, setShowUpload] = useState(null);
  const [applyToAllGrades, setApplyToAllGrades] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [userId, setUserId] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userName, setUserName] = useState("");
  const [formData, setFormData] = useState({
    projectName: '',
    classes: [{ room: '', capacity: '', building: '' }],
    faculty: [{ id: '', name: '', mail: '' }],
    subjects: [
      {
        code: '',
        subject: '',
        facultyIds: [],
        gradeSections: [],
        classesWeek: '',
        isCombined: false,
        assignedClasses: [],
      },
    ],
    grades: [{ 
      grade: '', 
      section: '', 
      strength: '',
      classAssignmentType: 'same'
    }],
    buildings: [],
    multipleBuildings: false,
    timeSlots: [{ day: '', startTime: '', endTime: '', applicableTo: [] }],
  });
  const [newBuildingInput, setNewBuildingInput] = useState('');
  const fileInputRef = useRef(null);

  // Get user info from localStorage or token
  useEffect(() => {
    // Get the token from localStorage
    const token = localStorage.getItem("token");
    console.log("Token found:", token ? "Yes" : "No");
    
    if (token) {
      try {
        // Decode the JWT token
        const decoded = jwtDecode(token);
        console.log("Decoded token:", decoded);
        
        if (decoded && decoded.id) {
          setUserId(decoded.id);
          if (decoded.name) setUserName(decoded.name);
          console.log("User ID set from token:", decoded.id);
        }
      } catch (error) {
        console.error("Error decoding token:", error);
      }
    }
    
    // Try to get user info from localStorage as fallback
    try {
      const userStr = localStorage.getItem("user");
      if (userStr) {
        const user = JSON.parse(userStr);
        console.log("User from localStorage:", user);
        
        if (user && user._id) {
          setUserId(user._id);
          if (user.name) setUserName(user.name);
          if (user.email) setUserEmail(user.email);
          console.log("User ID set from localStorage:", user._id);
        }
      }
    } catch (error) {
      console.error("Error parsing user from localStorage:", error);
    }
  }, []);

const generateTimetable = async () => {
  try {
    setIsGenerating(true);
    
    // Ensure we have a userId
    if (!userId) {
      console.warn("No user ID available. Using a token-based authorization instead.");
    }
    
    // Include userId in the request body
    const requestData = {
      ...formData,
      userId: userId // Adding the user ID to the request
    };
    
    console.log("Sending timetable generation request with user ID:", userId);
    
    // Include the auth token in header
    const token = localStorage.getItem("token");
    
    const response = await fetch(`${API_BASE_URL}/all/generate-direct`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : ''
      },
      body: JSON.stringify(requestData)
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'Failed to generate timetable');
    }
    
    const data = await response.json();
    console.log("Timetable generation response:", data);
    
    if (data.success) {
      // Check for timetableId in the response structure
      if (data.data && data.data.timetableId) {
        navigate(`/timetable/${data.data.timetableId}`);
      } else {
        console.error("Missing timetableId in response:", data);
        alert("Timetable was generated but ID is missing. Please check your timetables list.");
      }
    } else {
      throw new Error(data.message || 'Invalid response data');
    }
  } catch (error) {
    console.error('Error generating timetable:', error);
    alert(`Failed to generate timetable: ${error.message || 'Unknown error'}`);
  } finally {
    setIsGenerating(false);
  }
};  
  const loadJSONData = (json) => {
    try {
      const parsedData = JSON.parse(json);
      
      // Validate the data has the required structure
      if (
        parsedData.projectName &&
        Array.isArray(parsedData.classes) &&
        Array.isArray(parsedData.faculty) &&
        Array.isArray(parsedData.grades) &&
        Array.isArray(parsedData.subjects) &&
        Array.isArray(parsedData.timeSlots)
      ) {
        setFormData({
          ...parsedData,
          buildings: parsedData.buildings || [],
          multipleBuildings: parsedData.multipleBuildings || false
        });
        alert('Data loaded successfully!');
      } else {
        alert('Invalid JSON format. Please check the structure of your data.');
      }
    } catch (error) {
      console.error('Error parsing JSON:', error);
      alert('Failed to parse JSON data. Please check the format.');
    }
  };

  const goToNextStep = () => {
    if (currentStep < 7 && !showUpload && isStepValid()) {
      setCurrentStep(currentStep + 1);
    } else if (showUpload) {
      setShowUpload(null);
      if (currentStep < 7) setCurrentStep(currentStep + 1);
    }
  };

  const goToPreviousStep = () => {
    if (currentStep > 1) {
      if (showUpload) {
        setShowUpload(null);
      } else {
        setCurrentStep(currentStep - 1);
      }
    }
  };
  
  const loadRandomData = () => {
    setFormData({
      ...formData,
      projectName: sampleData.projectName,
      classes: [...sampleData.classes],
      faculty: [...sampleData.faculty],
      subjects: [...sampleData.subjects],
      grades: [...sampleData.grades],
      timeSlots: [...sampleData.timeSlots],
      buildings: [...sampleData.buildings],
      multipleBuildings: true
    });
  };

  const handleUploadClick = (step) => {
    setShowUpload(step);
    setTimeout(() => {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
        fileInputRef.current.click();
      }
    }, 100);
  };

  const validateCSVHeaders = (headers, expectedHeaders) => {
    return expectedHeaders.every(header => headers.includes(header));
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) {
      console.log('No file selected');
      return;
    }

    if (!file.name.endsWith('.csv')) {
      console.error('Please upload a CSV file');
      alert('Please upload a CSV file');
      return;
    }

    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        console.log('File content:', text);
        
        const rows = text.split('\n').map(row => row.split(',').map(item => item.trim()));
        if (rows.length < 2) {
          console.error('CSV file is empty or invalid');
          alert('CSV file is empty or invalid');
          return;
        }
        
        const headers = rows[0];
        const data = rows.slice(1).filter(row => row.length > 1);
        console.log('Headers:', headers);
        console.log('Data:', data);

        const expectedHeaders = {
          2: ['room', 'capacity', 'building'],
          3: ['id', 'name', 'mail'],
          4: ['grade', 'section', 'strength', 'classAssignmentType'],
          5: ['code', 'subject', 'facultyIds', 'gradeSections', 'classesWeek', 'isCombined', 'assignedClasses'],
          6: ['day', 'startTime', 'endTime', 'applicableTo']
        };

        if (!validateCSVHeaders(headers, expectedHeaders[showUpload])) {
          console.error('Invalid CSV format. Expected headers:', expectedHeaders[showUpload]);
          alert(`Invalid CSV format. Expected headers: ${expectedHeaders[showUpload].join(', ')}`);
          return;
        }

        switch (showUpload) {
          case 2: // Classes
            const newClasses = data.map(row => ({
              room: row[headers.indexOf('room')] || '',
              capacity: row[headers.indexOf('capacity')] || '',
              building: row[headers.indexOf('building')] || ''
            }));
            setFormData(prev => ({
              ...prev,
              classes: newClasses,
              multipleBuildings: newClasses.some(cls => cls.building !== ''),
              buildings: [...new Set(newClasses.map(cls => cls.building).filter(Boolean))]
            }));
            break;

          case 3: // Faculty
            const newFaculty = data.map(row => ({
              id: row[headers.indexOf('id')] || '',
              name: row[headers.indexOf('name')] || '',
              mail: row[headers.indexOf('mail')] || ''
            }));
            setFormData(prev => ({ ...prev, faculty: newFaculty }));
            break;

          case 4: // Grades
            const newGrades = data.map(row => ({
              grade: row[headers.indexOf('grade')] || '',
              section: row[headers.indexOf('section')] || '',
              strength: row[headers.indexOf('strength')] || '',
              classAssignmentType: row[headers.indexOf('classAssignmentType')]?.toLowerCase() === 'any' ? 'any' : 'same'
            }));
            setFormData(prev => ({ ...prev, grades: newGrades }));
            break;

          case 5: // Subjects
            const newSubjects = data.map(row => ({
              code: row[headers.indexOf('code')] || '',
              subject: row[headers.indexOf('subject')] || '',
              facultyIds: row[headers.indexOf('facultyIds')]?.split(';') || [],
              gradeSections: row[headers.indexOf('gradeSections')]?.split(';').map(gs => {
                const [grade, section] = gs.split('-');
                return { grade, section };
              }) || [],
              classesWeek: row[headers.indexOf('classesWeek')] || '',
              isCombined: row[headers.indexOf('isCombined')]?.toLowerCase() === 'true' || false,
              assignedClasses: row[headers.indexOf('assignedClasses')]?.split(';') || []
            }));
            setFormData(prev => ({ ...prev, subjects: newSubjects }));
            break;

          case 6: // Time Slots
            const newTimeSlots = data.map(row => ({
              day: row[headers.indexOf('day')] || '',
              startTime: row[headers.indexOf('startTime')] || '',
              endTime: row[headers.indexOf('endTime')] || '',
              applicableTo: row[headers.indexOf('applicableTo')]?.split(';') || []
            }));
            setFormData(prev => ({ ...prev, timeSlots: newTimeSlots }));
            break;

          default:
            break;
        }
        console.log('Updated form data:', formData);
      } catch (error) {
        console.error('Error processing CSV:', error);
        alert('Error processing CSV file');
      }
    };

    reader.onerror = (error) => {
      console.error('Error reading file:', error);
      alert('Error reading file');
    };

    reader.readAsText(file);
  };

  const handleInputChange = (step, index, field, value) => {
    const updatedData = { ...formData };
    updatedData[step][index][field] = value;
    setFormData(updatedData);
  };

  const handleMultipleBuildingsChange = (e) => {
    const updatedData = { ...formData, multipleBuildings: e.target.checked };
    if (!e.target.checked) {
      updatedData.classes = updatedData.classes.map((row) => ({ ...row, building: '' }));
    }
    setFormData(updatedData);
  };

  const handleApplyToAllGradesChange = (e) => {
    const isChecked = e.target.checked;
    setApplyToAllGrades(isChecked);
    if (isChecked && formData.grades.length > 0) {
      const firstGrade = formData.grades[0];
      const updatedGrades = formData.grades.map(grade => ({
        ...grade,
        classAssignmentType: firstGrade.classAssignmentType
      }));
      setFormData({ ...formData, grades: updatedGrades });
    }
  };

  const addNewBuilding = (index) => {
    if (newBuildingInput && newBuildingInput.trim() !== '') {
      const trimmedBuilding = newBuildingInput.trim();
      setFormData((prevData) => {
        const updatedClasses = [...prevData.classes];
        updatedClasses[index].building = trimmedBuilding;
        return {
          ...prevData,
          buildings: [...prevData.buildings, trimmedBuilding],
          classes: updatedClasses,
        };
      });
      setNewBuildingInput('');
    }
  };

  const handleSubjectCodeChange = (index, value) => {
    if (value === '+Add New Subject Code') {
      const newCode = prompt('Enter new subject code:');
      if (newCode && newCode.trim() !== '') {
        const trimmedCode = newCode.trim();
        setFormData((prevData) => {
          const updatedSubjects = [...prevData.subjects];
          updatedSubjects[index].code = trimmedCode;
          return { ...prevData, subjects: updatedSubjects };
        });
      }
    } else {
      handleInputChange('subjects', index, 'code', value);
    }
  };

  const handleSubjectChange = (index, value) => {
    if (value === '+Add New Subject') {
      const newSubject = prompt('Enter new subject:');
      if (newSubject && newSubject.trim() !== '') {
        const trimmedSubject = newSubject.trim();
        setFormData((prevData) => {
          const updatedSubjects = [...prevData.subjects];
          updatedSubjects[index].subject = trimmedSubject;
          return { ...prevData, subjects: updatedSubjects };
        });
      }
    } else {
      handleInputChange('subjects', index, 'subject', value);
    }
  };

  const handleBuildingChange = (index, value) => {
    if (value === '+Add New Building') {
    } else {
      const updatedData = { ...formData };
      updatedData.classes[index].building = value;
      setFormData(updatedData);
    }
  };

  const handleGradeSectionChange = (index, selectedOptions) => {
    const selectedValues = Array.from(selectedOptions).map((option) => option.value);
    const updatedData = { ...formData };
    updatedData.subjects[index].gradeSections = selectedValues.map((value) => {
      const [grade, section] = value.split(' - ');
      return { grade, section };
    });
    setFormData(updatedData);
  };

  const addNewRow = (step) => {
    const updatedData = { ...formData };
    const lastRow = updatedData[step][updatedData[step].length - 1];
    let isPreviousFilled = true;

    if (step === 'classes') {
      isPreviousFilled =
        lastRow.room.trim() !== '' &&
        lastRow.capacity.trim() !== '' &&
        (!formData.multipleBuildings || lastRow.building.trim() !== '');
    } else if (step === 'faculty') {
      isPreviousFilled =
        lastRow.id.trim() !== '' &&
        lastRow.name.trim() !== '' &&
        lastRow.mail.trim() !== '';
    } else if (step === 'subjects') {
      isPreviousFilled =
        lastRow.code.trim() !== '' &&
        lastRow.subject.trim() !== '' &&
        lastRow.facultyIds.length > 0 &&
        lastRow.gradeSections.length > 0 &&
        lastRow.classesWeek.trim() !== '';
    } else if (step === 'grades') {
      isPreviousFilled =
        lastRow.grade.trim() !== '' &&
        lastRow.section.trim() !== '' &&
        lastRow.strength.trim() !== '';
    } else if (step === 'timeSlots') {
      isPreviousFilled =
        lastRow.day.trim() !== '' &&
        lastRow.startTime.trim() !== '' &&
        lastRow.endTime.trim() !== '' &&
        lastRow.applicableTo.length > 0;
    }

    if (isPreviousFilled) {
      updatedData[step].push(
        step === 'classes'
          ? { room: '', capacity: '', building: '' }
          : step === 'faculty'
          ? { id: '', name: '', mail: '' }
          : step === 'subjects'
          ? {
              code: '',
              subject: '',
              facultyIds: [],
              gradeSections: [],
              classesWeek: '',
              isCombined: false,
              assignedClasses: [],
            }
          : step === 'grades'
          ? { 
              grade: '', 
              section: '', 
              strength: '',
              classAssignmentType: applyToAllGrades && updatedData.grades.length > 0 
                ? updatedData.grades[0].classAssignmentType 
                : 'same'
            }
          : { day: '', startTime: '', endTime: '', applicableTo: [] }
      );
      setFormData(updatedData);
    }
  };

  const deleteRow = (step, index) => {
    const updatedData = { ...formData };
    updatedData[step].splice(index, 1);
    setFormData(updatedData);
  };

  const isStepValid = () => {
    const data = formData[currentStep === 1 ? 'projectName' : currentStep === 2 ? 'classes' : currentStep === 3 ? 'faculty' : currentStep === 4 ? 'grades' : currentStep === 5 ? 'subjects' : 'timeSlots'];
    if (currentStep === 1) return formData.projectName.trim() !== '';
    if (currentStep === 2)
      return formData.classes.every(
        (row) =>
          row.room.trim() !== '' &&
          row.capacity.trim() !== '' &&
          (!formData.multipleBuildings || row.building.trim() !== '')
      );
    if (currentStep === 3)
      return formData.faculty.every(
        (row) => row.id.trim() !== '' && row.name.trim() !== '' && row.mail.trim() !== ''
      );
    if (currentStep === 4)
      return formData.grades.every(
        (row) => row.grade.trim() !== '' && row.section.trim() !== '' && row.strength.trim() !== ''
      );
    if (currentStep === 5)
      return formData.subjects.every(
        (row) =>
          row.code.trim() !== '' &&
          row.subject.trim() !== '' &&
          row.facultyIds.length > 0 &&
          row.gradeSections.length > 0 &&
          row.classesWeek.trim() !== ''
      );
    if (currentStep === 6)
      return formData.timeSlots.every(
        (row) =>
          row.day.trim() !== '' &&
          row.startTime.trim() !== '' &&
          row.endTime.trim() !== '' &&
          row.applicableTo.length > 0
      );
    return true;
  };

  const renderStep = () => {
    if (showUpload) {
      return (
        <div className="form-step">
          <h2>Upload CSV</h2>
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: 'none' }}
            accept=".csv"
            onChange={(e) => {
              handleFileUpload(e);
              e.target.value = '';
            }}
          />
          <button className="select-btn" onClick={() => fileInputRef.current?.click()}>
            Select Files
          </button>
          <button className="download-btn">Download Sample CSV</button>
          <button className="next-btn" onClick={goToNextStep}>
            Next
          </button>
        </div>
      );
    }

    switch (currentStep) {
      case 1:
        return (
          <div className="form-step">
            <h2>Project Name</h2>
            <input
              type="text"
              placeholder="Enter Project Name"
              value={formData.projectName}
              onChange={(e) => setFormData({ ...formData, projectName: e.target.value })}
            />
            <div style={{ marginTop: '15px', marginBottom: '15px' }}>
              <button 
                onClick={loadRandomData}
                style={{ 
                  backgroundColor: '#6a5acd', 
                  color: 'white', 
                  padding: '8px 16px', 
                  border: 'none', 
                  borderRadius: '4px', 
                  cursor: 'pointer',
                  marginRight: '10px'
                }}
              >
                Load Random Data
              </button>
              <button 
                onClick={() => {
                  const textarea = document.createElement('textarea');
                  textarea.style.position = 'fixed';
                  textarea.style.left = '0';
                  textarea.style.top = '0';
                  textarea.style.width = '100%';
                  textarea.style.height = '50%';
                  textarea.style.padding = '20px';
                  textarea.style.zIndex = '9999';
                  textarea.placeholder = 'Paste your JSON data here and click outside to load';
                  textarea.style.boxSizing = 'border-box';
                  
                  textarea.addEventListener('blur', () => {
                    if (textarea.value) {
                      loadJSONData(textarea.value);
                    }
                    document.body.removeChild(textarea);
                  });
                  
                  document.body.appendChild(textarea);
                  textarea.focus();
                }}
                style={{ 
                  backgroundColor: '#4CAF50', 
                  color: 'white', 
                  padding: '8px 16px', 
                  border: 'none', 
                  borderRadius: '4px', 
                  cursor: 'pointer',
                  marginRight: '10px'
                }}
              >
                Load JSON Data
              </button>
            </div>
            <button className="next-btn" onClick={goToNextStep} disabled={!isStepValid()}>
              Next
            </button>
          </div>
        );
      case 2:
        return (
          <div className="form-step">
            <h2>Classes</h2>
            <label>
              <input
                type="checkbox"
                checked={formData.multipleBuildings}
                onChange={handleMultipleBuildingsChange}
              /> Multiple Buildings
            </label>
            <table>
              <thead>
                <tr>
                  <th>Room</th>
                  <th>Room Capacity</th>
                  {formData.multipleBuildings && <th>Building Name</th>}
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {formData.classes.map((row, index) => (
                  <tr key={index}>
                    <td>
                      <input
                        type="text"
                        value={row.room}
                        onChange={(e) => handleInputChange('classes', index, 'room', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={row.capacity}
                        onChange={(e) =>
                          handleInputChange('classes', index, 'capacity', e.target.value)
                        }
                      />
                    </td>
                    {formData.multipleBuildings && (
                      <td>
                        <select
                          value={row.building}
                          onChange={(e) => handleBuildingChange(index, e.target.value)}
                        >
                          <option value="">Select Building</option>
                          {formData.buildings.map((building, i) => (
                            <option key={i} value={building}>
                              {building}
                            </option>
                          ))}
                          <option value="+Add New Building">+Add New Building</option>
                        </select>
                        {row.building === '+Add New Building' && (
                          <div>
                            <input
                              type="text"
                              value={newBuildingInput}
                              onChange={(e) => setNewBuildingInput(e.target.value)}
                              placeholder="Enter new building"
                            />
                            <button onClick={() => addNewBuilding(index)}>Add</button>
                          </div>
                        )}
                      </td>
                    )}
                    <td>
                      <button className="delete-btn" onClick={() => deleteRow('classes', index)}>
                        X
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button
              className="add-btn"
              onClick={() => addNewRow('classes')}
              disabled={
                formData.classes.length === 0 ||
                !(
                  formData.classes[formData.classes.length - 1].room.trim() !== '' &&
                  formData.classes[formData.classes.length - 1].capacity.trim() !== '' &&
                  (!formData.multipleBuildings ||
                    formData.classes[formData.classes.length - 1].building.trim() !== '')
                )
              }
            >
              Add New Room
            </button>
            <button className="upload-btn" onClick={() => handleUploadClick(2)}>
              Upload CSV
            </button>
            <button className="next-btn" onClick={goToNextStep} disabled={!isStepValid()}>
              Next
            </button>
          </div>
        );
      case 3:
        return (
          <div className="form-step">
            <h2>Faculty</h2>
            <table>
              <thead>
                <tr>
                  <th>Faculty_Id</th>
                  <th>Name</th>
                  <th>Mail Id</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {formData.faculty.map((row, index) => (
                  <tr key={index}>
                    <td>
                      <input
                        type="text"
                        value={row.id}
                        onChange={(e) => handleInputChange('faculty', index, 'id', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={row.name}
                        onChange={(e) => handleInputChange('faculty', index, 'name', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={row.mail}
                        onChange={(e) => handleInputChange('faculty', index, 'mail', e.target.value)}
                      />
                    </td>
                    <td>
                      <button className="delete-btn" onClick={() => deleteRow('faculty', index)}>
                        X
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button
              className="add-btn"
              onClick={() => addNewRow('faculty')}
              disabled={
                formData.faculty.length === 0 ||
                !(
                  formData.faculty[formData.faculty.length - 1].id.trim() !== '' &&
                  formData.faculty[formData.faculty.length - 1].name.trim() !== '' &&
                  formData.faculty[formData.faculty.length - 1].mail.trim() !== ''
                )
              }
            >
              Add New Faculty
            </button>
            <button className="upload-btn" onClick={() => handleUploadClick(3)}>
              Upload CSV
            </button>
            <button className="next-btn" onClick={goToNextStep} disabled={!isStepValid()}>
              Next
            </button>
          </div>
        );
      case 4:
        return (
          <div className="form-step">
            <h2>Grades</h2>
            <label style={{ marginBottom: '10px', display: 'block' }}>
              <input
                type="checkbox"
                checked={applyToAllGrades}
                onChange={handleApplyToAllGradesChange}
              />
              Apply class assignment type to all grades
            </label>
            <table>
              <thead>
                <tr>
                  <th>Grade</th>
                  <th>Section</th>
                  <th>Strength</th>
                  <th>Class Assignment Type</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {formData.grades.map((row, index) => (
                  <tr key={index}>
                    <td>
                      <input
                        type="text"
                        value={row.grade}
                        onChange={(e) => handleInputChange('grades', index, 'grade', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={row.section}
                        onChange={(e) =>
                          handleInputChange('grades', index, 'section', e.target.value)
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={row.strength}
                        onChange={(e) =>
                          handleInputChange('grades', index, 'strength', e.target.value)
                        }
                      />
                    </td>
                    <td>
                      <select
                        value={row.classAssignmentType}
                        onChange={(e) => {
                          handleInputChange('grades', index, 'classAssignmentType', e.target.value);
                          if (applyToAllGrades) {
                            const updatedGrades = formData.grades.map(grade => ({
                              ...grade,
                              classAssignmentType: e.target.value
                            }));
                            setFormData({ ...formData, grades: updatedGrades });
                          }
                        }}
                        disabled={applyToAllGrades && index !== 0}
                      >
                        <option value="same">Same Class</option>
                        <option value="any">Any Class</option>
                      </select>
                    </td>
                    <td>
                      <button className="delete-btn" onClick={() => deleteRow('grades', index)}>
                        X
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button
              className="add-btn"
              onClick={() => addNewRow('grades')}
              disabled={
                formData.grades.length === 0 ||
                !(
                  formData.grades[formData.grades.length - 1].grade.trim() !== '' &&
                  formData.grades[formData.grades.length - 1].section.trim() !== '' &&
                  formData.grades[formData.grades.length - 1].strength.trim() !== ''
                )
              }
            >
              Add New Grade
            </button>
            <button className="upload-btn" onClick={() => handleUploadClick(4)}>
              Upload CSV
            </button>
            <button className="next-btn" onClick={goToNextStep} disabled={!isStepValid()}>
              Next
            </button>
          </div>
        );
      case 5:
        return (
          <div className="form-step">
            <h2>Subjects</h2>
            <table>
              <thead>
                <tr>
                  <th>Subject Code</th>
                  <th>Subject</th>
                  <th>Faculty</th>
                  <th>Grade - Section</th>
                  <th>Combined?</th>
                  <th>Assigned Classes</th>
                  <th>Classes/Week</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {formData.subjects.map((row, index) => {
                  const handleAssignedClassesChange = (e) => {
                    const selectedClasses = Array.from(e.target.selectedOptions, option => option.value);
                    setFormData(prevData => ({
                      ...prevData,
                      subjects: prevData.subjects.map((subject, i) => 
                        i === index 
                          ? { ...subject, assignedClasses: selectedClasses }
                          : subject
                      )
                    }));
                  };

                  const handleSelectAll = () => {
                    const gradeSections = row.gradeSections.map(gs => `${gs.grade} - ${gs.section}`);
                    const assignedTypeGrades = formData.grades.filter(grade => 
                      gradeSections.includes(`${grade.grade} - ${grade.section}`) && 
                      grade.classAssignmentType === 'assigned'
                    );
                    if (assignedTypeGrades.length > 0) {
                      alert('Cannot use Select All when grades are set to Assigned type');
                      return;
                    }
                    const allClasses = formData.classes.map(cls => cls.room);
                    setFormData(prevData => ({
                      ...prevData,
                      subjects: prevData.subjects.map((subject, i) => 
                        i === index 
                          ? { ...subject, assignedClasses: allClasses }
                          : subject
                      )
                    }));
                  };

                  const handleClearClasses = () => {
                    setFormData(prevData => ({
                      ...prevData,
                      subjects: prevData.subjects.map((subject, i) => 
                        i === index 
                          ? { ...subject, assignedClasses: [] }
                          : subject
                      )
                    }));
                  };

                  const isAssignedType = row.gradeSections.some(gs => 
                    formData.grades.find(g => 
                      g.grade === gs.grade && 
                      g.section === gs.section && 
                      g.classAssignmentType === 'assigned'
                    )
                  );

                  return (
                    <tr key={index}>
                      <td>
                        <select
                          value={row.code}
                          onChange={(e) => handleSubjectCodeChange(index, e.target.value)}
                        >
                          <option value="">Select Subject Code</option>
                          <option value="Test">Test</option>
                          {[...new Set(formData.subjects.map((s) => s.code).filter(Boolean))].map(
                            (code, i) => (
                              <option key={i} value={code}>
                                {code}
                              </option>
                            )
                          )}
                          <option value="+Add New Subject Code">+Add New Subject Code</option>
                        </select>
                      </td>
                      <td>
                        <select
                          value={row.subject}
                          onChange={(e) => handleSubjectChange(index, e.target.value)}
                        >
                          <option value="">Select Subject</option>
                          <option value="hi">Hi</option>
                          {[...new Set(formData.subjects.map((s) => s.subject).filter(Boolean))].map(
                            (subject, i) => (
                              <option key={i} value={subject}>
                                {subject}
                              </option>
                            )
                          )}
                          <option value="+Add New Subject">+Add New Subject</option>
                        </select>
                      </td>
                      <td>
                        <select
                          multiple
                          value={row.facultyIds}
                          onChange={(e) =>
                            handleInputChange(
                              'subjects',
                              index,
                              'facultyIds',
                              Array.from(e.target.selectedOptions, (option) => option.value)
                            )
                          }
                          style={{ width: '150px', height: '100px', padding: '5px', borderRadius: '4px' }}
                        >
                          {formData.faculty.map((faculty, i) => (
                            <option key={i} value={faculty.id}>
                              {faculty.id} - {faculty.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <select
                          multiple
                          value={row.gradeSections.map((gs) => `${gs.grade} - ${gs.section}`)}
                          onChange={(e) => handleGradeSectionChange(index, e.target.selectedOptions)}
                          style={{ width: '150px', height: '100px', padding: '5px', borderRadius: '4px' }}
                        >
                          {formData.grades.map((grade, i) => (
                            <option key={i} value={`${grade.grade} - ${grade.section}`}>
                              {grade.grade} - {grade.section}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          type="checkbox"
                          checked={row.isCombined}
                          onChange={(e) =>
                            handleInputChange('subjects', index, 'isCombined', e.target.checked)
                          }
                        />
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                          <div style={{ display: 'flex', gap: '5px' }}>
                            <button 
                              onClick={handleSelectAll}
                              disabled={isAssignedType}
                              style={{ padding: '2px 5px', fontSize: '12px' }}
                            >
                              Select All
                            </button>
                            <button 
                              onClick={handleClearClasses}
                              disabled={isAssignedType}
                              style={{ padding: '2px 5px', fontSize: '12px' }}
                            >
                              Clear
                            </button>
                          </div>
                          <select
                            multiple
                            value={row.assignedClasses}
                            onChange={handleAssignedClassesChange}
                            disabled={isAssignedType}
                            style={{ width: '150px', height: '100px', padding: '5px', borderRadius: '4px' }}
                          >
                            {formData.classes.map((cls, i) => (
                              <option key={i} value={cls.room}>
                                {cls.room}
                              </option>
                            ))}
                          </select>
                        </div>
                      </td>
                      <td>
                        <input
                          type="text"
                          value={row.classesWeek}
                          onChange={(e) =>
                            handleInputChange('subjects', index, 'classesWeek', e.target.value)
                          }
                        />
                      </td>
                      <td>
                        <button className="delete-btn" onClick={() => deleteRow('subjects', index)}>
                          X
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <button
              className="add-btn"
              onClick={() => addNewRow('subjects')}
              disabled={
                formData.subjects.length === 0 ||
                !(
                  formData.subjects[formData.subjects.length - 1].code.trim() !== '' &&
                  formData.subjects[formData.subjects.length - 1].subject.trim() !== '' &&
                  formData.subjects[formData.subjects.length - 1].facultyIds.length > 0 &&
                  formData.subjects[formData.subjects.length - 1].gradeSections.length > 0 &&
                  formData.subjects[formData.subjects.length - 1].classesWeek.trim() !== ''
                )
              }
            >
              Add New Subject
            </button>
            <button className="upload-btn" onClick={() => handleUploadClick(5)}>
              Upload CSV
            </button>
            <button className="next-btn" onClick={goToNextStep} disabled={!isStepValid()}>
              Next
            </button>
            <p style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
              Hold Ctrl (Windows) or Cmd (Mac) to select multiple options.
            </p>
          </div>
        );
      case 6:
        return (
          <div className="form-step">
            <h2>Time Slots</h2>
            <table>
              <thead>
                <tr>
                  <th>Day</th>
                  <th>Start Time</th>
                  <th>End Time</th>
                  <th>Applicable To (Grade - Section)</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {formData.timeSlots.map((row, index) => {
                  const isTimeOverlapping = (start, end, checkIndex) => {
                    return formData.timeSlots.some((slot, i) => {
                      if (i === checkIndex) return false;
                      if (slot.day !== row.day) return false;
                      const slotStart = slot.startTime;
                      const slotEnd = slot.endTime;
                      return (
                        (start >= slotStart && start < slotEnd) ||
                        (end > slotStart && end <= slotEnd) ||
                        (start <= slotStart && end >= slotEnd)
                      );
                    });
                  };

                  const overlappingSlots = formData.timeSlots.filter(
                    (slot, i) =>
                      i !== index &&
                      slot.day === row.day &&
                      isTimeOverlapping(row.startTime, row.endTime, index)
                  );
                  const usedGradeSections = new Set(
                    overlappingSlots.flatMap(slot => slot.applicableTo)
                  );

                  const availableGradeSections = formData.grades.filter(
                    grade => !usedGradeSections.has(`${grade.grade} - ${grade.section}`)
                  );

                  return (
                    <tr key={index}>
                      <td>
                        <select
                          value={row.day}
                          onChange={(e) => handleInputChange('timeSlots', index, 'day', e.target.value)}
                        >
                          <option value="">Select Day</option>
                          {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(
                            (day) => (
                              <option key={day} value={day}>
                                {day}
                              </option>
                            )
                          )}
                        </select>
                      </td>
                      <td>
                        <input
                          type="time"
                          value={row.startTime}
                          onChange={(e) =>
                            handleInputChange('timeSlots', index, 'startTime', e.target.value)
                          }
                        />
                      </td>
                      <td>
                        <input
                          type="time"
                          value={row.endTime}
                          onChange={(e) =>
                            handleInputChange('timeSlots', index, 'endTime', e.target.value)
                          }
                        />
                      </td>
                      <td>
                        <select
                          multiple
                          value={row.applicableTo}
                          onChange={(e) => {
                            const selectedOptions = Array.from(e.target.selectedOptions, option => option.value);
                            handleInputChange('timeSlots', index, 'applicableTo', selectedOptions);
                          }}
                          style={{ width: '150px', height: '100px', padding: '5px', borderRadius: '4px' }}
                          disabled={!row.day || !row.startTime || !row.endTime}
                        >
                          {availableGradeSections.map((grade, i) => (
                            <option key={i} value={`${grade.grade} - ${grade.section}`}>
                              {grade.grade} - {grade.section}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <button className="delete-btn" onClick={() => deleteRow('timeSlots', index)}>
                          X
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <button
              className="add-btn"
              onClick={() => addNewRow('timeSlots')}
              disabled={
                formData.timeSlots.length === 0 ||
                !(
                  formData.timeSlots[formData.timeSlots.length - 1].day.trim() !== '' &&
                  formData.timeSlots[formData.timeSlots.length - 1].startTime.trim() !== '' &&
                  formData.timeSlots[formData.timeSlots.length - 1].endTime.trim() !== '' &&
                  formData.timeSlots[formData.timeSlots.length - 1].applicableTo.length > 0
                )
              }
            >
              Add New Time Slot
            </button>
            <button className="upload-btn" onClick={() => handleUploadClick(6)}>
              Upload CSV
            </button>
            <button className="next-btn" onClick={goToNextStep} disabled={!isStepValid()}>
              Next
            </button>
            <p style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
              Hold Ctrl (Windows) or Cmd (Mac) to select multiple options.
            </p>
          </div>
        );
      case 7:
        return (
          <div className="form-step">
            <h2>Summary</h2>
            <div style={{ marginBottom: '20px' }}>
              <h3>Project Name</h3>
              <p>{formData.projectName}</p>
            </div>
            <div style={{ marginBottom: '20px' }}>
              <h3>Classes</h3>
              <table>
                <thead>
                  <tr>
                    <th>Room</th>
                    <th>Room Capacity</th>
                    {formData.multipleBuildings && <th>Building Name</th>}
                  </tr>
                </thead>
                <tbody>
                  {formData.classes.map((row, index) => (
                    <tr key={index}>
                      <td>{row.room}</td>
                      <td>{row.capacity}</td>
                      {formData.multipleBuildings && <td>{row.building}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ marginBottom: '20px' }}>
              <h3>Faculty</h3>
              <table>
                <thead>
                  <tr>
                    <th>Faculty_Id</th>
                    <th>Name</th>
                    <th>Mail Id</th>
                  </tr>
                </thead>
                <tbody>
                  {formData.faculty.map((row, index) => (
                    <tr key={index}>
                      <td>{row.id}</td>
                      <td>{row.name}</td>
                      <td>{row.mail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ marginBottom: '20px' }}>
              <h3>Grades</h3>
              <table>
                <thead>
                  <tr>
                    <th>Grade</th>
                    <th>Section</th>
                    <th>Strength</th>
                    <th>Class Assignment Type</th>
                  </tr>
                </thead>
                <tbody>
                  {formData.grades.map((row, index) => (
                    <tr key={index}>
                      <td>{row.grade}</td>
                      <td>{row.section}</td>
                      <td>{row.strength}</td>
                      <td>{row.classAssignmentType === 'same' ? 'Same Class' : 'Any Class'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ marginBottom: '20px' }}>
              <h3>Subjects</h3>
              <table>
                <thead>
                  <tr>
                    <th>Subject Code</th>
                    <th>Subject</th>
                    <th>Faculty</th>
                    <th>Grade - Section</th>
                    <th>Combined?</th>
                    <th>Assigned Classes</th>
                    <th>Classes/Week</th>
                  </tr>
                </thead>
                <tbody>
                  {formData.subjects.map((row, index) => (
                    <tr key={index}>
                      <td>{row.code}</td>
                      <td>{row.subject}</td>
                      <td>{row.facultyIds.join(', ')}</td>
                      <td>{row.gradeSections.map((gs) => `${gs.grade} - ${gs.section}`).join(', ')}</td>
                      <td>{row.isCombined ? 'Yes' : 'No'}</td>
                      <td>{row.assignedClasses.length > 0 ? row.assignedClasses.join(', ') : 'None'}</td>
                      <td>{row.classesWeek}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ marginBottom: '20px' }}>
              <h3>Time Slots</h3>
              <table>
                <thead>
                  <tr>
                    <th>Day</th>
                    <th>Start Time</th>
                    <th>End Time</th>
                    <th>Applicable To (Grade - Section)</th>
                  </tr>
                </thead>
                <tbody>
                  {formData.timeSlots.map((row, index) => (
                    <tr key={index}>
                      <td>{row.day}</td>
                      <td>{row.startTime}</td>
                      <td>{row.endTime}</td>
                      <td>{row.applicableTo.join(', ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* User Information Section */}
            <div style={{ marginBottom: '20px', background: '#f5f5f5', padding: '15px', borderRadius: '5px' }}>
              <h3>User Information</h3>
              <table>
                <tbody>
                  <tr>
                    <td><strong>User ID:</strong></td>
                    <td>{userId || "Not logged in"}</td>
                  </tr>
                  {userName && (
                    <tr>
                      <td><strong>Name:</strong></td>
                      <td>{userName}</td>
                    </tr>
                  )}
                  {userEmail && (
                    <tr>
                      <td><strong>Email:</strong></td>
                      <td>{userEmail}</td>
                    </tr>
                  )}
                </tbody>
              </table>
              <p style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
                This timetable will be associated with your account.
              </p>
            </div>
            
            <div className="button-group" style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button className="previous-btn" onClick={goToPreviousStep}>
                Back
              </button>
              <button 
                className="generate-btn" 
                onClick={generateTimetable}
                disabled={isGenerating}
                style={{ 
                  backgroundColor: '#4CAF50',
                  color: 'white',
                  padding: '10px 20px',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  fontWeight: 'bold'
                }}
              >
                {isGenerating ? 'Generating...' : 'Generate Timetable Directly'}
              </button>
              <button 
                onClick={() => {
                  const jsonData = JSON.stringify(formData, null, 2);
                  const blob = new Blob([jsonData], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `${formData.projectName.replace(/\s+/g, '_')}_timetable_data.json`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                }}
                style={{ 
                  backgroundColor: '#2196F3',
                  color: 'white',
                  padding: '10px 20px',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '16px'
                }}
              >
                Export Data as JSON
              </button>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div>
      <TopBar />
      <div className="container" style={{ marginTop: '60px' }}>
        <div className="progress-bar">
          <span className="back-arrow" onClick={goToPreviousStep}>
            ←
          </span>
          <div className="steps">
            {[1, 2, 3, 4, 5, 6, 7].map((step) => (
              <span
                key={step}
                className={`step ${currentStep >= step ? 'active' : ''}`}
              >
                {step}
              </span>
            ))}
          </div>
        </div>
        <div className="form-container">{renderStep()}</div>
      </div>
    </div>
  );
};

export default MultiStepForm;